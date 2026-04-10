export type TestStudent = {
  id: string;
  name: string;
  email: string;
};

export const TEST_STUDENTS: TestStudent[] = [
  {
    id: "test-student-maya-chen",
    name: "Maya Chen",
    email: "maya@test-student.com",
  },
  {
    id: "test-student-jordan-patel",
    name: "Jordan Patel",
    email: "jordan@test-student.com",
  },
  {
    id: "test-student-sofia-ramirez",
    name: "Sofia Ramirez",
    email: "sofia@test-student.com",
  },
  {
    id: "test-student-ethan-park",
    name: "Ethan Park",
    email: "ethan@test-student.com",
  },
  {
    id: "test-student-amina-hassan",
    name: "Amina Hassan",
    email: "amina@test-student.com",
  },
];

export const findTestStudentByEmail = (
  email: string | null | undefined,
): TestStudent | null => {
  if (!email) {
    return null;
  }

  const normalizedEmail = email.trim().toLowerCase();
  return (
    TEST_STUDENTS.find(
      (student) => student.email.trim().toLowerCase() === normalizedEmail,
    ) ?? null
  );
};
