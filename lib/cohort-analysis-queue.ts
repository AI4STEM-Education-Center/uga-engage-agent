import { SendMessageBatchCommand, SQSClient } from "@aws-sdk/client-sqs";

const DEFAULT_ENGAGE_AWS_REGION = "us-east-2";

const queueUrl = process.env.COHORT_ANALYSIS_QUEUE_URL?.trim();
const awsRegion = process.env.ENGAGE_AWS_REGION ?? DEFAULT_ENGAGE_AWS_REGION;
const awsAccessKeyId = process.env.ENGAGE_AWS_ACCESS_KEY_ID;
const awsSecretAccessKey = process.env.ENGAGE_AWS_SECRET_ACCESS_KEY;

let sqsClient: SQSClient | null = null;

const getSqsClient = () => {
  if (!queueUrl) {
    return null;
  }

  if (!sqsClient) {
    sqsClient = new SQSClient({
      region: awsRegion,
      ...(awsAccessKeyId &&
        awsSecretAccessKey && {
          credentials: {
            accessKeyId: awsAccessKeyId,
            secretAccessKey: awsSecretAccessKey,
          },
        }),
    });
  }

  return sqsClient;
};

const chunkItems = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

export const isCohortAnalysisQueueConfigured = () => Boolean(queueUrl);

export const enqueueCohortJobStudents = async ({
  jobId,
  classId,
  assignmentId,
  totalStudents,
  students,
}: {
  jobId: string;
  classId: string;
  assignmentId: string;
  totalStudents: number;
  students: Array<{
    id: string;
    name: string;
    assignment?: string;
    answers: Record<string, string | undefined>;
  }>;
}) => {
  if (!queueUrl) {
    throw new Error("COHORT_ANALYSIS_QUEUE_URL is not configured.");
  }

  const client = getSqsClient();
  if (!client) {
    throw new Error("Failed to initialize the cohort analysis queue client.");
  }

  const chunks = chunkItems(students, 10);
  for (const chunk of chunks) {
    const response = await client.send(
      new SendMessageBatchCommand({
        QueueUrl: queueUrl,
        Entries: chunk.map((student) => ({
          Id: student.id,
          MessageBody: JSON.stringify({
            jobId,
            classId,
            assignmentId,
            totalStudents,
            student,
          }),
        })),
      }),
    );

    if ((response.Failed ?? []).length > 0) {
      const firstError = response.Failed?.[0];
      throw new Error(
        firstError?.Message ??
          `Failed to enqueue ${response.Failed?.length ?? 1} student message(s).`,
      );
    }
  }
};
