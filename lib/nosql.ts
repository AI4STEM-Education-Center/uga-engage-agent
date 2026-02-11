import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

type StrategyCacheRecord = {
  plan_json: string;
  updated_at: string;
};

type Store = {
  strategy_cache: Record<string, StrategyCacheRecord>;
  teacher_annotations: TeacherAnnotation[];
};

type TeacherAnnotation = {
  annotation_id: string;
  student_name?: string | null;
  assignment?: string | null;
  overall_recommendation: string;
  recommendation_reason?: string | null;
  decision: "agree" | "disagree";
  reason?: string | null;
  ai_plan: Record<string, unknown>;
  selected_strategies: string[];
  answers: Record<string, string | undefined>;
  created_at: string;
};

export type TeacherAnnotationInput = Omit<
  TeacherAnnotation,
  "annotation_id" | "created_at"
>;

const emptyStore: Store = { strategy_cache: {}, teacher_annotations: [] };
const dataDir = path.join(process.cwd(), "data");
const storePath = path.join(dataDir, "engage-nosql.json");

const useDynamoDb = Boolean(process.env.DYNAMODB_TABLE);
const dynamoRegion = process.env.ENGAGE_AWS_REGION;
const dynamoTableName = process.env.DYNAMODB_TABLE ?? "";
const dynamoAccessKeyId = process.env.ENGAGE_AWS_ACCESS_KEY_ID;
const dynamoSecretAccessKey = process.env.ENGAGE_AWS_SECRET_ACCESS_KEY;
const pkField = "class_id";
const skField = "record_id";
const gsiTeacherPkField = "teacher_id";
const gsiTeacherSkField = "teacher_record_id";
const gsiStudentPkField = "student_id";
const gsiStudentSkField = "student_record_id";

let storeCache: Store | null = null;
let loadPromise: Promise<Store> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

let dynamoDocClient: DynamoDBDocumentClient | null = null;

const getDynamoClient = () => {
  if (!useDynamoDb) {
    return null;
  }
  if (!dynamoRegion) {
    throw new Error("ENGAGE_AWS_REGION is required when using DynamoDB.");
  }
  if (!dynamoTableName) {
    throw new Error("DYNAMODB_TABLE is required when using DynamoDB.");
  }
  if (!dynamoDocClient) {
    const client = new DynamoDBClient({
      region: dynamoRegion,
      ...(dynamoAccessKeyId &&
        dynamoSecretAccessKey && {
          credentials: {
            accessKeyId: dynamoAccessKeyId,
            secretAccessKey: dynamoSecretAccessKey,
          },
        }),
    });
    dynamoDocClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return dynamoDocClient;
};

const ensureDataDir = async () => {
  if (!fs.existsSync(dataDir)) {
    await fs.promises.mkdir(dataDir, { recursive: true });
  }
};

const loadStore = async () => {
  if (storeCache) {
    return storeCache;
  }
  if (!loadPromise) {
    loadPromise = (async () => {
      await ensureDataDir();
      if (!fs.existsSync(storePath)) {
        await fs.promises.writeFile(
          storePath,
          `${JSON.stringify(emptyStore, null, 2)}\n`,
        );
      }
      const raw = await fs.promises.readFile(storePath, "utf-8");
      const parsed = JSON.parse(raw) as Store;
      if (!parsed.strategy_cache || typeof parsed.strategy_cache !== "object") {
        throw new Error("Invalid NoSQL store format.");
      }
      if (!Array.isArray(parsed.teacher_annotations)) {
        parsed.teacher_annotations = [];
      }
      storeCache = parsed;
      return parsed;
    })();
  }
  const result = await loadPromise;
  loadPromise = null;
  return result;
};

const persistStore = async (store: Store) => {
  await fs.promises.writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`);
  storeCache = store;
};

const withWriteLock = async <T>(fn: () => Promise<T>) => {
  const task = writeQueue.then(fn, fn);
  writeQueue = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
};

export const getCachedPlanJson = async (
  classId: string,
  sessionId: string,
  studentId: string,
) => {
  if (useDynamoDb) {
    const client = getDynamoClient();
    if (!client) {
      return null;
    }
    const result = await client.send(
      new GetCommand({
        TableName: dynamoTableName,
        Key: {
          [pkField]: `CLASS#${classId}`,
          [skField]: `PLAN#SESSION#${sessionId}#STUDENT#${studentId}#LATEST`,
        },
      }),
    );
    return (result.Item?.plan_json as string | undefined) ?? null;
  }

  const store = await loadStore();
  return store.strategy_cache[studentId]?.plan_json ?? null;
};

export const upsertCachedPlanJson = async (
  classId: string,
  sessionId: string,
  studentId: string,
  planJson: string,
) => {
  if (useDynamoDb) {
    const client = getDynamoClient();
    if (!client) {
      return;
    }
    const updatedAt = new Date().toISOString();
    await client.send(
      new PutCommand({
        TableName: dynamoTableName,
        Item: {
          // Partition/sort keys — must not be overwritten
          [pkField]: `CLASS#${classId}`,
          [skField]: `PLAN#SESSION#${sessionId}#STUDENT#${studentId}#LATEST`,
          record_type: "plan_cache",
          session_id: sessionId,
          // GSI keys: student_id (PK) and student_record_id (SK); plain ID extracted via STUDENT# prefix when reading
          [gsiStudentPkField]: `STUDENT#${studentId}`,
          [gsiStudentSkField]: `PLAN#SESSION#${sessionId}#LATEST`,
          plan_json: planJson,
          updated_at: updatedAt,
        },
      }),
    );
    return;
  }

  await withWriteLock(async () => {
    const store = await loadStore();
    store.strategy_cache[studentId] = {
      plan_json: planJson,
      updated_at: new Date().toISOString(),
    };
    await persistStore(store);
  });
};

export type CachedPlanRecord = {
  student_id: string;
  session_id: string;
  class_id: string;
  plan_json: string;
  updated_at: string;
};

/**
 * List all cached plans for a given class + session.
 * Optionally filter to a single student.
 */
export const listCachedPlans = async (
  classId: string,
  sessionId: string,
  studentId?: string,
): Promise<CachedPlanRecord[]> => {
  if (useDynamoDb) {
    const client = getDynamoClient();
    if (!client) {
      return [];
    }

    if (studentId) {
      // Specific student — use direct GetItem (cheaper than query)
      const result = await client.send(
        new GetCommand({
          TableName: dynamoTableName,
          Key: {
            [pkField]: `CLASS#${classId}`,
            [skField]: `PLAN#SESSION#${sessionId}#STUDENT#${studentId}#LATEST`,
          },
        }),
      );
      if (!result.Item?.plan_json) {
        return [];
      }
      const raw = result.Item.student_id as string;
      const plain = raw?.replace(/^STUDENT#/, "") ?? studentId;
      return [
        {
          student_id: plain,
          session_id: (result.Item.session_id as string) ?? sessionId,
          class_id: classId,
          plan_json: result.Item.plan_json as string,
          updated_at: (result.Item.updated_at as string) ?? "",
        },
      ];
    }

    // All students in this class+session — query by PK + SK prefix
    const result = await client.send(
      new QueryCommand({
        TableName: dynamoTableName,
        KeyConditionExpression:
          "#pk = :pk AND begins_with(#sk, :skPrefix)",
        ExpressionAttributeNames: {
          "#pk": pkField,
          "#sk": skField,
        },
        ExpressionAttributeValues: {
          ":pk": `CLASS#${classId}`,
          ":skPrefix": `PLAN#SESSION#${sessionId}#STUDENT#`,
        },
      }),
    );

    const plainStudentId = (sid: string) =>
      sid?.replace(/^STUDENT#/, "") ?? "";

    return (result.Items ?? [])
      .filter((item) => item.record_type === "plan_cache" && item.plan_json)
      .map((item) => ({
        student_id: plainStudentId(item.student_id as string) ||
          (item.student_id as string) ||
          "",
        session_id: (item.session_id as string) ?? sessionId,
        class_id: classId,
        plan_json: item.plan_json as string,
        updated_at: (item.updated_at as string) ?? "",
      }));
  }

  // Local JSON fallback
  const store = await loadStore();
  const records: CachedPlanRecord[] = [];
  for (const [sid, record] of Object.entries(store.strategy_cache)) {
    if (studentId && sid !== studentId) {
      continue;
    }
    records.push({
      student_id: sid,
      session_id: sessionId,
      class_id: classId,
      plan_json: record.plan_json,
      updated_at: record.updated_at,
    });
  }
  return records;
};

export const recordTeacherAnnotation = async (
  input: TeacherAnnotationInput,
) => {
  const createdAt = new Date().toISOString();
  const annotationId = crypto.randomUUID();
  const record: TeacherAnnotation = {
    annotation_id: annotationId,
    created_at: createdAt,
    ...input,
  };

  if (useDynamoDb) {
    const client = getDynamoClient();
    if (!client) {
      return record;
    }
    const partition = "ANNOTATIONS";
    await client.send(
      new PutCommand({
        TableName: dynamoTableName,
        Item: {
          record_type: "teacher_annotation",
          // Use a stable partition since UI no longer collects IDs.
          [pkField]: `CLASS#${partition}`,
          [skField]: `ANNOTATION#${annotationId}`,
          ...record,
        },
      }),
    );
    return record;
  }

  await withWriteLock(async () => {
    const store = await loadStore();
    store.teacher_annotations.push(record);
    await persistStore(store);
  });

  return record;
};
