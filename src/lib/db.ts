// Client-side local storage DB to replace Prisma

const DB_KEY = 'acls_cases';

export const getCases = () => {
  try {
    const data = localStorage.getItem(DB_KEY);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.error("Failed to parse cases from localStorage", err);
    return [];
  }
};

export const getCaseById = (id: string) => {
  const cases = getCases();
  return cases.find((c: any) => c.id === id);
};

export const saveCase = (caseData: any) => {
  const cases = getCases();
  const newCase = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...caseData
  };
  cases.unshift(newCase);
  localStorage.setItem(DB_KEY, JSON.stringify(cases));
  return newCase;
};

export const deleteCase = (id: string) => {
  const cases = getCases();
  const newCases = cases.filter((c: any) => c.id !== id);
  localStorage.setItem(DB_KEY, JSON.stringify(newCases));
};