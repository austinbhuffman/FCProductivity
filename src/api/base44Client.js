const STORAGE_PREFIX = 'fcproductivity.local';
const CURRENT_USER_KEY = `${STORAGE_PREFIX}.currentUserId`;
const APP_LOGS_KEY = `${STORAGE_PREFIX}.appLogs`;

const KNOWN_ENTITIES = [
  'AppSettings',
  'AuditLog',
  'DailyLog',
  'MCRCase',
  'MedicaidBabyLog',
  'MonthEndSubmission',
  'Notification',
  'PayerBreakdown',
  'PaymentPlan',
  'PaymentPlanSchedule',
  'ScheduleOverride',
  'User',
  'WalkInCallIn',
  'Query',
];

const DEFAULT_USERS = [
  {
    id: 'user-admin',
    full_name: 'Admin User',
    display_name: 'Admin User',
    email: 'admin@local.test',
    app_role: 'admin',
    active_flag: true,
    can_access_vim: true,
    location: 'RMC',
    theme: 'default',
  },
  {
    id: 'user-staff',
    full_name: 'Staff User',
    display_name: 'Staff User',
    email: 'staff@local.test',
    app_role: 'staff',
    active_flag: true,
    can_access_vim: false,
    location: 'NMC',
    theme: 'default',
  },
];

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const clone = (value) => JSON.parse(JSON.stringify(value));

const parseJson = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const nowIso = () => new Date().toISOString();

const makeId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const entityStorageKey = (entityName) => `${STORAGE_PREFIX}.entity.${entityName}`;

const readEntityRows = (entityName) => {
  if (!isBrowser) return [];
  return parseJson(window.localStorage.getItem(entityStorageKey(entityName)), []);
};

const writeEntityRows = (entityName, rows) => {
  if (!isBrowser) return;
  window.localStorage.setItem(entityStorageKey(entityName), JSON.stringify(rows));
};

const ensureEntity = (entityName) => {
  if (!isBrowser) return;
  const key = entityStorageKey(entityName);
  if (window.localStorage.getItem(key) === null) {
    writeEntityRows(entityName, []);
  }
};

const ensureSeedData = () => {
  if (!isBrowser) return;

  for (const entityName of KNOWN_ENTITIES) {
    ensureEntity(entityName);
  }

  const users = readEntityRows('User');
  if (users.length === 0) {
    const seededUsers = DEFAULT_USERS.map((user) => ({
      ...user,
      created_date: nowIso(),
      updated_date: nowIso(),
    }));
    writeEntityRows('User', seededUsers);
    window.localStorage.setItem(CURRENT_USER_KEY, seededUsers[0].id);
    return;
  }

  const currentUserId = window.localStorage.getItem(CURRENT_USER_KEY);
  if (!currentUserId || !users.some((user) => user.id === currentUserId)) {
    window.localStorage.setItem(CURRENT_USER_KEY, users[0].id);
  }
};

const compareValues = (a, b) => {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;

  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }

  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return Number(a) - Number(b);
  }

  if (typeof a === 'string' && typeof b === 'string') {
    const aDate = Date.parse(a);
    const bDate = Date.parse(b);
    if (!Number.isNaN(aDate) && !Number.isNaN(bDate)) {
      return aDate - bDate;
    }
    return a.localeCompare(b);
  }

  return String(a).localeCompare(String(b));
};

const sortRows = (rows, sortArg) => {
  if (!sortArg || typeof sortArg !== 'string') return rows;

  const descending = sortArg.startsWith('-');
  const field = descending ? sortArg.slice(1) : sortArg;

  return [...rows].sort((left, right) => {
    const comparison = compareValues(left[field], right[field]);
    return descending ? -comparison : comparison;
  });
};

const limitRows = (rows, limitArg) => {
  if (typeof limitArg !== 'number' || Number.isNaN(limitArg)) {
    return rows;
  }
  if (limitArg < 0) return rows;
  return rows.slice(0, limitArg);
};

const matchesFilter = (row, filterArg) => {
  if (!filterArg || typeof filterArg !== 'object') return true;

  return Object.entries(filterArg).every(([key, value]) => {
    if (Array.isArray(value)) {
      return value.includes(row[key]);
    }
    return row[key] === value;
  });
};

const buildEntityApi = (entityName) => {
  const listRows = () => {
    ensureSeedData();
    ensureEntity(entityName);
    return readEntityRows(entityName);
  };

  const saveRows = (rows) => {
    writeEntityRows(entityName, rows);
  };

  return {
    async list(sortArg, limitArg) {
      const rows = listRows();
      const sorted = sortRows(rows, sortArg);
      return clone(limitRows(sorted, limitArg));
    },

    async filter(filterArg, sortArg, limitArg) {
      const rows = listRows();
      const filtered = rows.filter((row) => matchesFilter(row, filterArg));
      const sorted = sortRows(filtered, sortArg);
      return clone(limitRows(sorted, limitArg));
    },

    async create(data = {}) {
      const rows = listRows();
      const newRow = {
        ...data,
        id: data.id || makeId(),
        created_date: data.created_date || nowIso(),
        updated_date: nowIso(),
      };

      rows.push(newRow);
      saveRows(rows);
      return clone(newRow);
    },

    async update(id, data = {}) {
      const rows = listRows();
      const index = rows.findIndex((row) => row.id === id);

      if (index === -1) {
        const error = new Error(`${entityName} with id ${id} not found`);
        error.status = 404;
        throw error;
      }

      const updatedRow = {
        ...rows[index],
        ...data,
        id: rows[index].id,
        updated_date: nowIso(),
      };

      rows[index] = updatedRow;
      saveRows(rows);

      if (entityName === 'User' && isBrowser) {
        const currentUserId = window.localStorage.getItem(CURRENT_USER_KEY);
        if (currentUserId === id) {
          window.localStorage.setItem(CURRENT_USER_KEY, id);
        }
      }

      return clone(updatedRow);
    },

    async delete(id) {
      const rows = listRows();
      const index = rows.findIndex((row) => row.id === id);

      if (index === -1) {
        return { success: false };
      }

      rows.splice(index, 1);
      saveRows(rows);

      if (entityName === 'User' && isBrowser) {
        const currentUserId = window.localStorage.getItem(CURRENT_USER_KEY);
        if (currentUserId === id) {
          const remainingUsers = readEntityRows('User');
          if (remainingUsers.length > 0) {
            window.localStorage.setItem(CURRENT_USER_KEY, remainingUsers[0].id);
          }
        }
      }

      return { success: true };
    },
  };
};

const entityCache = new Map();

const entities = new Proxy(
  {},
  {
    get(_target, property) {
      if (typeof property !== 'string') return undefined;

      if (!entityCache.has(property)) {
        entityCache.set(property, buildEntityApi(property));
      }

      return entityCache.get(property);
    },
  }
);

const getCurrentUser = () => {
  ensureSeedData();

  const users = readEntityRows('User');
  if (users.length === 0) {
    const fallback = {
      ...DEFAULT_USERS[0],
      created_date: nowIso(),
      updated_date: nowIso(),
    };
    writeEntityRows('User', [fallback]);
    if (isBrowser) {
      window.localStorage.setItem(CURRENT_USER_KEY, fallback.id);
    }
    return fallback;
  }

  if (!isBrowser) {
    return users[0];
  }

  const currentUserId = window.localStorage.getItem(CURRENT_USER_KEY);
  const currentUser = users.find((user) => user.id === currentUserId) || users[0];
  window.localStorage.setItem(CURRENT_USER_KEY, currentUser.id);
  return currentUser;
};

const auth = {
  async me() {
    return clone(getCurrentUser());
  },

  async logout() {
    // Local mode has no external auth provider.
    return { success: true, localMode: true };
  },

  redirectToLogin() {
    // Intentionally a no-op in local mode.
  },
};

const appLogs = {
  async logUserInApp(pageName) {
    if (!isBrowser) return { success: true };

    const logs = parseJson(window.localStorage.getItem(APP_LOGS_KEY), []);
    const user = getCurrentUser();

    logs.unshift({
      id: makeId(),
      user_id: user.id,
      page: pageName,
      created_date: nowIso(),
    });

    window.localStorage.setItem(APP_LOGS_KEY, JSON.stringify(logs.slice(0, 250)));
    return { success: true };
  },
};

const localIntegrationResult = (name, payload) => {
  console.info(`[local integration] ${name} called`, payload);
  return { success: true, localMode: true };
};

const integrations = {
  Core: {
    async InvokeLLM(payload) {
      return { text: 'Local mode: InvokeLLM is not configured.', ...localIntegrationResult('InvokeLLM', payload) };
    },
    async SendEmail(payload) {
      return localIntegrationResult('SendEmail', payload);
    },
    async SendSMS(payload) {
      return localIntegrationResult('SendSMS', payload);
    },
    async UploadFile(payload) {
      return localIntegrationResult('UploadFile', payload);
    },
    async GenerateImage(payload) {
      return localIntegrationResult('GenerateImage', payload);
    },
    async ExtractDataFromUploadedFile(payload) {
      return localIntegrationResult('ExtractDataFromUploadedFile', payload);
    },
  },
};

ensureSeedData();

export const base44 = {
  auth,
  entities,
  appLogs,
  integrations,
};
