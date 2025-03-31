// This is a placeholder db.ts that doesn't try to connect to a real database
// Use this for development until ready to integrate with actual PostgreSQL database
import * as schema from "@shared/schema";

// Dummy pool object for session store
export const pool = {
  query: async () => ({ rows: [] }),
  connect: () => ({ release: () => {} }),
};

// Dummy db object
export const db = {
  select: () => ({
    from: () => ({
      where: () => [],
      orderBy: () => ({
        limit: () => []
      }),
      limit: () => [],
      groupBy: () => []
    })
  }),
  insert: () => ({
    values: () => ({
      returning: () => []
    })
  }),
  update: () => ({
    set: () => ({
      where: () => ({
        returning: () => []
      })
    })
  }),
  delete: () => ({
    where: () => {}
  })
};