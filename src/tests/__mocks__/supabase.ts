const supabaseMock = {
  from: jest.fn(() => supabaseMock),
  select: jest.fn(() => supabaseMock),
  insert: jest.fn(() => supabaseMock),
  update: jest.fn(() => supabaseMock),
  delete: jest.fn(() => supabaseMock),
  eq: jest.fn(() => supabaseMock),
  single: jest.fn(() => supabaseMock),
  order: jest.fn(() => supabaseMock),
  limit: jest.fn(() => supabaseMock),
  rpc: jest.fn(() => Promise.resolve({ data: null, error: null })),
};

export default supabaseMock;