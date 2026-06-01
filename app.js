const DB_NAME = 'MyGalleryDB';
const DB_VERSION = 7;
const STORE_NAME = 'entries';
const FOLDERS_STORE = 'folders';
const SETTINGS_STORE = 'settings';
const LEGACY_STORE_NAME = 'images';
const APP_LOCK_ID = 'appLock';
const PBKDF2_ITERATIONS = 210000;
const PASSWORD_MIN_LENGTH = 4;
const AUTH_SESSION = {
  REAL: 'real',
  DECOY: 'decoy',
};
const DEFAULT_DECOY_FOLDER_NAME = 'サンプル';

const ENTRY_TYPE = {
  IMAGE: 'image',
  TEXT: 'text',
};

const fileInput = document.getElementById('fileInput');
const galleryEl = document.getElementById('gallery');
const statusEl = document.getElementById('status');
const lightboxEl = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxClose = document.getElementById('lightboxClose');
const lightboxDetail = document.getElementById('lightboxDetail');
const addTextBtn = document.getElementById('addTextBtn');
const textModal = document.getElementById('textModal');
const textForm = document.getElementById('textForm');
const textTitleInput = document.getElementById('textTitle');
const textBodyInput = document.getElementById('textBody');
const textModalCancel = document.getElementById('textModalCancel');
const textViewModal = document.getElementById('textViewModal');
const textViewDetail = document.getElementById('textViewDetail');
const textViewClose = document.getElementById('textViewClose');
const textViewCloseBtn = document.getElementById('textViewCloseBtn');
const enterDeleteModeBtn = document.getElementById('enterDeleteModeBtn');
const enterMoveModeBtn = document.getElementById('enterMoveModeBtn');
const deleteModeBar = document.getElementById('deleteModeBar');
const moveModeBar = document.getElementById('moveModeBar');
const selectionCountEl = document.getElementById('selectionCount');
const moveSelectionCountEl = document.getElementById('moveSelectionCount');
const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
const cancelDeleteModeBtn = document.getElementById('cancelDeleteModeBtn');
const moveTargetSelect = document.getElementById('moveTargetSelect');
const moveSelectedBtn = document.getElementById('moveSelectedBtn');
const cancelMoveModeBtn = document.getElementById('cancelMoveModeBtn');
const searchInput = document.getElementById('searchInput');
const searchClearBtn = document.getElementById('searchClearBtn');
const favoritesOnlyFilter = document.getElementById('favoritesOnlyFilter');
const sortSelect = document.getElementById('sortSelect');
const folderListEl = document.getElementById('folderList');
const createFolderBtn = document.getElementById('createFolderBtn');
const folderModal = document.getElementById('folderModal');
const folderForm = document.getElementById('folderForm');
const folderNameInput = document.getElementById('folderNameInput');
const folderModalCancel = document.getElementById('folderModalCancel');
const exportBackupBtn = document.getElementById('exportBackupBtn');
const importBackupInput = document.getElementById('importBackupInput');
const loginScreen = document.getElementById('loginScreen');
const appShell = document.getElementById('appShell');
const loginForm = document.getElementById('loginForm');
const loginHeading = document.getElementById('loginHeading');
const loginSubtitle = document.getElementById('loginSubtitle');
const loginPasswordInput = document.getElementById('loginPassword');
const loginPasswordConfirmInput = document.getElementById('loginPasswordConfirm');
const loginConfirmField = document.getElementById('loginConfirmField');
const loginSubmitBtn = document.getElementById('loginSubmitBtn');
const loginErrorEl = document.getElementById('loginError');
const loginSetupSecondary = document.getElementById('loginSetupSecondary');
const loginDecoyPasswordInput = document.getElementById('loginDecoyPassword');
const loginDecoyPasswordConfirmInput = document.getElementById('loginDecoyPasswordConfirm');
const decoySettingsBtn = document.getElementById('decoySettingsBtn');
const importBackupLabel = document.getElementById('importBackupLabel');
const decoySettingsModal = document.getElementById('decoySettingsModal');
const decoySettingsForm = document.getElementById('decoySettingsForm');
const decoySettingsPassword = document.getElementById('decoySettingsPassword');
const decoySettingsPasswordConfirm = document.getElementById('decoySettingsPasswordConfirm');
const decoySettingsRemove = document.getElementById('decoySettingsRemove');
const decoySettingsCancel = document.getElementById('decoySettingsCancel');
const decoySettingsError = document.getElementById('decoySettingsError');
const folderDecoyField = document.getElementById('folderDecoyField');
const folderDecoyCheckbox = document.getElementById('folderDecoyCheckbox');

const BACKUP_FORMAT = 'myGalleryBackup';
const BACKUP_FORMAT_VERSION = 1;

const SORT_MODE = {
  NEWEST: 'newest',
  OLDEST: 'oldest',
  UPDATED: 'updated',
  TITLE_ASC: 'titleAsc',
  TITLE_DESC: 'titleDesc',
  FAVORITE: 'favorite',
};

const SORT_MODE_LABELS = {
  [SORT_MODE.NEWEST]: '新しい順',
  [SORT_MODE.OLDEST]: '古い順',
  [SORT_MODE.UPDATED]: '更新日時順',
  [SORT_MODE.TITLE_ASC]: 'タイトル昇順',
  [SORT_MODE.TITLE_DESC]: 'タイトル降順',
  [SORT_MODE.FAVORITE]: 'お気に入り優先',
};

const SORT_STORAGE_KEY = 'myGallery.sortMode';

const activeUrls = new Set();
let isDeleteMode = false;
let isMoveMode = false;
const selectedIds = new Set();
let showFavoritesOnly = false;
let sortMode = loadSortMode();
/** null = すべて表示 */
let selectedFolderId = null;
/** メモリ上の全エントリ（検索・一覧用） */
let cachedEntries = [];
/** メモリ上のフォルダ一覧 */
let cachedFolders = [];

/** 詳細表示中のエントリ */
let detailEntry = null;
let lightboxDetailController = null;
let textViewDetailController = null;
let isAuthenticated = false;
/** @type {'setup' | 'login'} */
let loginMode = 'login';
/** @type {'real' | 'decoy'} */
let authSessionMode = AUTH_SESSION.REAL;

// --- データ構造 ---

/**
 * 共通フィールド（画像・テキスト共通）:
 * - entryType, title, createdAt, updatedAt
 * - tags: string[]
 * - folderId: number | null
 * - isFavorite: boolean
 * - favoriteAt: number | null
 *
 * フォルダ (folders ストア):
 * - id, name, createdAt, updatedAt
 * - isLocked, isDecoy, passwordHash（将来のパスワード・デコイ用）
 */
function normalizeFolderId(folderId) {
  if (folderId == null || folderId === '') return null;
  const id = Number(folderId);
  return Number.isFinite(id) ? id : null;
}

function createFolderRecord(name, { isDecoy = false } = {}) {
  const now = Date.now();
  return {
    name: name.trim(),
    createdAt: now,
    updatedAt: now,
    isLocked: false,
    isDecoy: Boolean(isDecoy),
    passwordHash: null,
  };
}

function normalizeFolder(folder) {
  return {
    ...folder,
    isLocked: Boolean(folder.isLocked),
    isDecoy: Boolean(folder.isDecoy),
    passwordHash: folder.passwordHash ?? null,
    updatedAt: folder.updatedAt ?? folder.createdAt ?? Date.now(),
  };
}

function getFolderById(folderId) {
  const id = normalizeFolderId(folderId);
  if (id == null) return null;
  return cachedFolders.find((f) => f.id === id) ?? null;
}

function isDecoyFolder(folderId) {
  return Boolean(getFolderById(folderId)?.isDecoy);
}

function isDecoySession() {
  return authSessionMode === AUTH_SESSION.DECOY;
}

function folderVisibleInSession(folder) {
  return isDecoySession() ? Boolean(folder.isDecoy) : !folder.isDecoy;
}

function entryVisibleInSession(entry) {
  return isDecoySession() ? isDecoyFolder(entry.folderId) : !isDecoyFolder(entry.folderId);
}

function getSessionEntries() {
  return cachedEntries.filter(entryVisibleInSession);
}

function getFolderName(folderId) {
  const id = normalizeFolderId(folderId);
  if (id == null) return null;
  const folder = cachedFolders.find((f) => f.id === id);
  return folder?.name ?? null;
}

function countEntriesInFolder(folderId) {
  const id = normalizeFolderId(folderId);
  const sessionEntries = getSessionEntries();
  if (id == null) return sessionEntries.length;
  return sessionEntries.filter((e) => normalizeFolderId(e.folderId) === id).length;
}

function getScopeEntries() {
  const sessionEntries = getSessionEntries();
  if (selectedFolderId == null) return sessionEntries;
  return sessionEntries.filter((e) => normalizeFolderId(e.folderId) === selectedFolderId);
}

function isSelectionMode() {
  return isDeleteMode || isMoveMode;
}

function closeAllModalsForSelectionMode() {
  closeLightbox();
  closeTextView();
  closeTextModal();
  closeFolderModal();
  closeDecoySettingsModal();
}
function createBaseFields(title) {
  const now = Date.now();
  return {
    title,
    createdAt: now,
    updatedAt: now,
    tags: [],
    folderId: null,
    isFavorite: false,
    favoriteAt: null,
  };
}

function createImageRecord(file) {
  return {
    entryType: ENTRY_TYPE.IMAGE,
    ...createBaseFields(file.name),
    mimeType: file.type,
    blob: file,
  };
}

function createTextRecord(title, body) {
  return {
    entryType: ENTRY_TYPE.TEXT,
    ...createBaseFields(title),
    body,
  };
}

function resolveEntryTimestamp(entry, primary, secondary) {
  const primaryVal = entry[primary];
  if (typeof primaryVal === 'number' && Number.isFinite(primaryVal)) return primaryVal;
  const secondaryVal = entry[secondary];
  if (typeof secondaryVal === 'number' && Number.isFinite(secondaryVal)) return secondaryVal;
  if (typeof entry.id === 'number' && Number.isFinite(entry.id)) return entry.id;
  return 0;
}

function normalizeEntry(entry) {
  const isFavorite = Boolean(entry.isFavorite);
  const createdAt = resolveEntryTimestamp(entry, 'createdAt', 'updatedAt') || Date.now();
  const updatedAt = resolveEntryTimestamp(entry, 'updatedAt', 'createdAt') || createdAt;
  return {
    ...entry,
    tags: normalizeTagsList(entry.tags),
    folderId: normalizeFolderId(entry.folderId),
    isFavorite,
    createdAt,
    updatedAt,
    favoriteAt: entry.favoriteAt ?? (isFavorite ? updatedAt : null),
  };
}

function formatUpdatedAt(timestamp) {
  if (!timestamp) return '';
  return `更新: ${new Date(timestamp).toLocaleString('ja-JP')}`;
}

function getEntryTags(entry) {
  return normalizeTagsList(entry?.tags);
}

function normalizeTagName(tag) {
  return String(tag).trim().replace(/\s+/g, ' ');
}

/** 検索用に正規化したタグ配列（重複除去・空除外） */
function normalizeTagsList(tags) {
  const seen = new Set();
  const result = [];
  for (const tag of tags || []) {
    const name = normalizeTagName(tag);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

function parseTagInput(value) {
  return value
    .split(/[,、]/)
    .map(normalizeTagName)
    .filter(Boolean);
}

function getEntryLabel(entry) {
  return entry.title || entry.name || '(無題)';
}

function isTextEntry(entry) {
  return entry.entryType === ENTRY_TYPE.TEXT;
}

function isImageEntry(entry) {
  return entry.entryType === ENTRY_TYPE.IMAGE || (!isTextEntry(entry) && Boolean(entry.blob));
}

// --- 検索 ---

function normalizeSearchQuery(query) {
  return String(query ?? '').trim().toLowerCase();
}

/** タイトルまたはタグの部分一致（大文字小文字を区別しない） */
function entryMatchesSearch(entry, query) {
  const q = normalizeSearchQuery(query);
  if (!q) return true;

  if (getEntryLabel(entry).toLowerCase().includes(q)) return true;

  return getEntryTags(entry).some((tag) => tag.toLowerCase().includes(q));
}

function filterEntries(items, query) {
  return items.filter((entry) => entryMatchesSearch(entry, query));
}

function entryPassesFilters(entry, query) {
  if (!entryVisibleInSession(entry)) return false;
  if (selectedFolderId != null && normalizeFolderId(entry.folderId) !== selectedFolderId) {
    return false;
  }
  if (showFavoritesOnly && !entry.isFavorite) return false;
  return entryMatchesSearch(entry, query);
}

function isValidSortMode(mode) {
  return Object.values(SORT_MODE).includes(mode);
}

function loadSortMode() {
  try {
    const saved = localStorage.getItem(SORT_STORAGE_KEY);
    if (saved && isValidSortMode(saved)) return saved;
  } catch (_) {
    /* localStorage 不可時はデフォルト */
  }
  return SORT_MODE.NEWEST;
}

function saveSortMode(mode) {
  try {
    localStorage.setItem(SORT_STORAGE_KEY, mode);
  } catch (_) {
    /* ignore */
  }
}

function compareById(a, b) {
  return (a.id ?? 0) - (b.id ?? 0);
}

function compareTitlesAsc(a, b) {
  return getEntryLabel(a).localeCompare(getEntryLabel(b), 'ja', { sensitivity: 'base' });
}

function sortEntries(items) {
  const sorted = [...items];

  switch (sortMode) {
    case SORT_MODE.OLDEST:
      sorted.sort((a, b) => {
        const diff = a.createdAt - b.createdAt;
        return diff !== 0 ? diff : compareById(a, b);
      });
      break;
    case SORT_MODE.UPDATED:
      sorted.sort((a, b) => {
        const diff = b.updatedAt - a.updatedAt;
        return diff !== 0 ? diff : compareById(a, b);
      });
      break;
    case SORT_MODE.TITLE_ASC:
      sorted.sort((a, b) => {
        const diff = compareTitlesAsc(a, b);
        return diff !== 0 ? diff : compareById(a, b);
      });
      break;
    case SORT_MODE.TITLE_DESC:
      sorted.sort((a, b) => {
        const diff = compareTitlesAsc(b, a);
        return diff !== 0 ? diff : compareById(a, b);
      });
      break;
    case SORT_MODE.FAVORITE:
      sorted.sort((a, b) => {
        if (a.isFavorite !== b.isFavorite) {
          return Number(b.isFavorite) - Number(a.isFavorite);
        }
        if (a.isFavorite && b.isFavorite) {
          const diff =
            (b.favoriteAt ?? b.updatedAt ?? b.createdAt) -
            (a.favoriteAt ?? a.updatedAt ?? a.createdAt);
          if (diff !== 0) return diff;
        }
        const diff = b.createdAt - a.createdAt;
        return diff !== 0 ? diff : compareById(a, b);
      });
      break;
    case SORT_MODE.NEWEST:
    default:
      sorted.sort((a, b) => {
        const diff = b.createdAt - a.createdAt;
        return diff !== 0 ? diff : compareById(a, b);
      });
      break;
  }

  return sorted;
}

function initSortSelect() {
  if (!sortSelect) return;
  sortSelect.value = isValidSortMode(sortMode) ? sortMode : SORT_MODE.NEWEST;
}

function countFavorites(items) {
  return items.filter((entry) => entry.isFavorite).length;
}

function updateGalleryStatus(allItems, visibleItems, query) {
  const trimmedQuery = String(query ?? '').trim();
  const sessionEntries = getSessionEntries();
  const totalFavorite = countFavorites(sessionEntries);
  const totalImage = sessionEntries.filter((i) => isImageEntry(i)).length;
  const totalText = sessionEntries.filter((i) => isTextEntry(i)).length;

  if (sessionEntries.length === 0) {
    statusEl.textContent = 'コンテンツがありません。画像またはテキストを追加してください。';
    return;
  }

  if (allItems.length === 0 && selectedFolderId != null) {
    const folderName = getFolderName(selectedFolderId) || '選択中のフォルダ';
    statusEl.textContent = `「${folderName}」にアイテムはありません（全体 ${sessionEntries.length} 件）`;
    return;
  }

  const imageCount = visibleItems.filter((i) => isImageEntry(i)).length;
  const textCount = visibleItems.filter((i) => isTextEntry(i)).length;
  const visibleFavorite = countFavorites(visibleItems);
  const scopeFavorite = countFavorites(allItems);

  const suffixParts = [];
  if (selectedFolderId != null) {
    suffixParts.push(`フォルダ: ${getFolderName(selectedFolderId) || '不明'}`);
  }
  if (showFavoritesOnly) suffixParts.push('お気に入りのみ');
  if (sortMode !== SORT_MODE.NEWEST && SORT_MODE_LABELS[sortMode]) {
    suffixParts.push(SORT_MODE_LABELS[sortMode]);
  }
  if (trimmedQuery) suffixParts.push(`検索: ${trimmedQuery}`);
  const suffix = suffixParts.length > 0 ? ` — ${suffixParts.join(' / ')}` : '';

  if (trimmedQuery || showFavoritesOnly || selectedFolderId != null) {
    if (visibleItems.length === 0) {
      statusEl.textContent =
        `0 / ${allItems.length} 件（⭐ ${scopeFavorite}）に一致する項目はありません（全体 ${sessionEntries.length} 件 / ⭐ ${totalFavorite}）${suffix}`;
      return;
    }
    statusEl.textContent =
      `${visibleItems.length} / ${allItems.length} 件（表示 ⭐ ${visibleFavorite} / 画像 ${imageCount} / テキスト ${textCount} — 全体 ${sessionEntries.length} 件 / ⭐ ${totalFavorite}）${suffix}`;
    return;
  }

  statusEl.textContent =
    `${sessionEntries.length} 件（⭐ ${totalFavorite} / 画像 ${totalImage} / テキスト ${totalText}）${suffix}`;
}

function reorderGalleryCards() {
  const sorted = sortEntries(getSessionEntries());
  for (const entry of sorted) {
    const li = galleryEl.querySelector(`li[data-entry-id="${entry.id}"]`);
    if (li) galleryEl.appendChild(li);
  }
}

function applyGalleryFilter() {
  const query = searchInput?.value ?? '';

  if (searchClearBtn) {
    searchClearBtn.hidden = !query.trim();
  }

  reorderGalleryCards();

  const visibleItems = [];
  const cards = galleryEl.querySelectorAll('li[data-entry-id]');
  for (const li of cards) {
    const id = Number(li.dataset.entryId);
    const entry = cachedEntries.find((e) => e.id === id);
    const visible = entry && entryPassesFilters(entry, query);
    li.hidden = !visible;
    if (visible) visibleItems.push(entry);
  }

  updateGalleryStatus(getScopeEntries(), visibleItems, query);
}
function updateCachedEntry(updated) {
  const index = cachedEntries.findIndex((e) => e.id === updated.id);
  if (index >= 0) {
    cachedEntries[index] = normalizeEntry(updated);
  }
}

// --- IndexedDB ---

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;
      const tx = event.target.transaction;

      let store;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('entryType', 'entryType', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('folderId', 'folderId', { unique: false });
        store.createIndex('title', 'title', { unique: false });
        store.createIndex('tags', 'tags', { unique: false, multiEntry: true });
        store.createIndex('isFavorite', 'isFavorite', { unique: false });
      } else {
        store = tx.objectStore(STORE_NAME);
      }

      if (store && !store.indexNames.contains('tags')) {
        store.createIndex('tags', 'tags', { unique: false, multiEntry: true });
      }

      if (store && !store.indexNames.contains('isFavorite')) {
        store.createIndex('isFavorite', 'isFavorite', { unique: false });
      }

      if (oldVersion >= 1 && oldVersion < 2 && db.objectStoreNames.contains(LEGACY_STORE_NAME)) {
        const oldStore = tx.objectStore(LEGACY_STORE_NAME);
        const newStore = tx.objectStore(STORE_NAME);

        oldStore.openCursor().onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            const item = cursor.value;
            const createdAt = item.createdAt || Date.now();
            newStore.add({
              entryType: ENTRY_TYPE.IMAGE,
              title: item.name,
              mimeType: item.type,
              blob: item.blob,
              createdAt,
              updatedAt: createdAt,
              tags: [],
              folderId: null,
              isFavorite: false,
              favoriteAt: null,
            });
            cursor.continue();
          } else {
            db.deleteObjectStore(LEGACY_STORE_NAME);
          }
        };
      }

      if (oldVersion > 0 && oldVersion < 3 && db.objectStoreNames.contains(STORE_NAME)) {
        const entryStore = tx.objectStore(STORE_NAME);
        entryStore.openCursor().onsuccess = (e) => {
          const cursor = e.target.result;
          if (!cursor) return;
          const entry = cursor.value;
          if (!Array.isArray(entry.tags)) {
            entry.tags = [];
            entry.updatedAt = entry.updatedAt || entry.createdAt || Date.now();
            cursor.update(entry);
          }
          cursor.continue();
        };
      }

      if (oldVersion > 0 && oldVersion < 4 && db.objectStoreNames.contains(STORE_NAME)) {
        const entryStore = tx.objectStore(STORE_NAME);
        entryStore.openCursor().onsuccess = (e) => {
          const cursor = e.target.result;
          if (!cursor) return;
          const entry = cursor.value;
          let changed = false;
          if (entry.isFavorite === undefined) {
            entry.isFavorite = false;
            changed = true;
          }
          if (entry.folderId === undefined) {
            entry.folderId = null;
            changed = true;
          }
          if (entry.updatedAt === undefined) {
            entry.updatedAt = entry.createdAt || Date.now();
            changed = true;
          }
          if (changed) cursor.update(entry);
          cursor.continue();
        };
      }

      if (oldVersion > 0 && oldVersion < 5 && db.objectStoreNames.contains(STORE_NAME)) {
        const entryStore = tx.objectStore(STORE_NAME);
        entryStore.openCursor().onsuccess = (e) => {
          const cursor = e.target.result;
          if (!cursor) return;
          const entry = cursor.value;
          let changed = false;
          if (entry.isFavorite === undefined) {
            entry.isFavorite = false;
            changed = true;
          }
          if (entry.favoriteAt === undefined) {
            entry.favoriteAt = entry.isFavorite
              ? entry.updatedAt || entry.createdAt || Date.now()
              : null;
            changed = true;
          }
          if (changed) cursor.update(entry);
          cursor.continue();
        };
      }

      if (!db.objectStoreNames.contains(FOLDERS_STORE)) {
        const folderStore = db.createObjectStore(FOLDERS_STORE, {
          keyPath: 'id',
          autoIncrement: true,
        });
        folderStore.createIndex('name', 'name', { unique: false });
        folderStore.createIndex('createdAt', 'createdAt', { unique: false });
        folderStore.createIndex('isDecoy', 'isDecoy', { unique: false });
      }

      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'id' });
      }
    };
  });
}

function getSetting(db, id) {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
      resolve(undefined);
      return;
    }
    const tx = db.transaction(SETTINGS_STORE, 'readonly');
    const request = tx.objectStore(SETTINGS_STORE).get(id);
    let result;
    request.onsuccess = () => {
      result = request.result;
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function putSetting(db, record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SETTINGS_STORE, 'readwrite');
    tx.objectStore(SETTINGS_STORE).put(record);
    tx.oncomplete = () => resolve(record.id);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function getAppLockSettings(db) {
  return getSetting(db, APP_LOCK_ID);
}

function isPasswordConfigured(appLock) {
  return Boolean(appLock?.passwordHash?.digest && appLock?.passwordHash?.salt);
}

function isDecoyPasswordConfigured(appLock) {
  return Boolean(appLock?.decoyPasswordHash?.digest && appLock?.decoyPasswordHash?.salt);
}

function assertWebCryptoAvailable() {
  if (!globalThis.crypto?.subtle) {
    throw new Error('この環境では Web Crypto API が利用できません。HTTPS または localhost で開いてください。');
  }
}

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function derivePasswordDigest(password, saltBase64, iterations = PBKDF2_ITERATIONS) {
  assertWebCryptoAvailable();
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: base64ToUint8Array(saltBase64),
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return bufferToBase64(hashBuffer);
}

function timingSafeEqualString(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function createPasswordHashRecord(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltBase64 = bufferToBase64(salt.buffer);
  const digest = await derivePasswordDigest(password, saltBase64, PBKDF2_ITERATIONS);
  return {
    version: 1,
    algorithm: 'PBKDF2',
    hashAlgorithm: 'SHA-256',
    iterations: PBKDF2_ITERATIONS,
    salt: saltBase64,
    digest,
  };
}

async function verifyPassword(password, passwordHashRecord) {
  if (!passwordHashRecord?.salt || !passwordHashRecord?.digest) return false;
  const iterations = passwordHashRecord.iterations || PBKDF2_ITERATIONS;
  const derived = await derivePasswordDigest(password, passwordHashRecord.salt, iterations);
  return timingSafeEqualString(derived, passwordHashRecord.digest);
}

async function saveAppLockSettings(db, { passwordHash, decoyPasswordHash } = {}) {
  const now = Date.now();
  const existing = await getAppLockSettings(db);
  await putSetting(db, {
    id: APP_LOCK_ID,
    passwordHash: passwordHash ?? existing?.passwordHash ?? null,
    decoyPasswordHash:
      decoyPasswordHash !== undefined ? decoyPasswordHash : existing?.decoyPasswordHash ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

async function ensureDefaultDecoyFolder(db) {
  const folders = await getAllFolders(db);
  if (folders.some((folder) => folder.isDecoy)) return null;
  return addFolder(db, createFolderRecord(DEFAULT_DECOY_FOLDER_NAME, { isDecoy: true }));
}

function getDefaultDecoyFolderId() {
  const folder = cachedFolders.find((f) => f.isDecoy);
  return folder?.id ?? null;
}

function getTargetFolderIdForNewEntry() {
  if (!isDecoySession()) return null;
  if (selectedFolderId != null && isDecoyFolder(selectedFolderId)) {
    return selectedFolderId;
  }
  return getDefaultDecoyFolderId();
}

function showLoginError(message) {
  if (!loginErrorEl) return;
  if (!message) {
    loginErrorEl.hidden = true;
    loginErrorEl.textContent = '';
    return;
  }
  loginErrorEl.hidden = false;
  loginErrorEl.textContent = message;
}

function configureLoginScreen(mode, hasExistingData = false) {
  loginMode = mode;
  const isSetup = mode === 'setup';

  loginForm?.reset();
  showLoginError('');

  if (loginHeading) {
    loginHeading.textContent = isSetup ? 'パスワードを設定' : 'My Gallery';
  }
  if (loginSubtitle) {
    loginSubtitle.textContent = isSetup
      ? hasExistingData
        ? 'パスワードが未設定です。パスワードを設定してください。（既存のデータはそのまま利用できます）'
        : '初回起動です。パスワードを設定してください。'
      : 'パスワードを入力してください。';
  }
  if (loginConfirmField) {
    loginConfirmField.hidden = !isSetup;
  }
  if (loginSetupSecondary) {
    loginSetupSecondary.hidden = !isSetup;
  }
  if (loginPasswordConfirmInput) {
    loginPasswordConfirmInput.required = isSetup;
  }
  if (loginPasswordInput) {
    loginPasswordInput.autocomplete = isSetup ? 'new-password' : 'current-password';
  }
  if (loginSubmitBtn) {
    loginSubmitBtn.textContent = isSetup ? '設定して開始' : 'ログイン';
  }
  loginPasswordInput?.focus();
}

function showLoginScreen(mode, hasExistingData = false) {
  isAuthenticated = false;
  authSessionMode = AUTH_SESSION.REAL;
  document.body.classList.add('is-locked');
  if (appShell) appShell.hidden = true;
  if (loginScreen) loginScreen.hidden = false;
  configureLoginScreen(mode, hasExistingData);
}

function unlockApp() {
  isAuthenticated = true;
  document.body.classList.remove('is-locked');
  if (loginScreen) loginScreen.hidden = true;
  if (appShell) appShell.hidden = false;
  showLoginError('');
  updateSessionUI();
}

function updateSessionUI() {
  const decoy = isDecoySession();
  document.body.classList.toggle('decoy-session', decoy);
  if (exportBackupBtn) exportBackupBtn.hidden = decoy;
  if (importBackupLabel) importBackupLabel.hidden = decoy;
  if (decoySettingsBtn) decoySettingsBtn.hidden = decoy;
}

function validatePasswordInput(password, confirmPassword, secondaryPassword = '', secondaryConfirmPassword = '') {
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    return `パスワードは ${PASSWORD_MIN_LENGTH} 文字以上にしてください`;
  }
  if (loginMode === 'setup' && password !== confirmPassword) {
    return 'パスワード（確認）が一致しません';
  }
  if (loginMode === 'setup' && secondaryPassword) {
    if (secondaryPassword.length < PASSWORD_MIN_LENGTH) {
      return `追加のパスワードは ${PASSWORD_MIN_LENGTH} 文字以上にしてください`;
    }
    if (secondaryPassword !== secondaryConfirmPassword) {
      return '追加のパスワード（確認）が一致しません';
    }
    if (secondaryPassword === password) {
      return '追加のパスワードはパスワードと異なるものにしてください';
    }
  }
  return '';
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  showLoginError('');

  const password = loginPasswordInput?.value ?? '';
  const confirmPassword = loginPasswordConfirmInput?.value ?? '';
  const decoyPassword = loginDecoyPasswordInput?.value ?? '';
  const decoyConfirmPassword = loginDecoyPasswordConfirmInput?.value ?? '';
  const validationError = validatePasswordInput(
    password,
    confirmPassword,
    decoyPassword,
    decoyConfirmPassword
  );
  if (validationError) {
    showLoginError(validationError);
    return;
  }

  if (loginSubmitBtn) loginSubmitBtn.disabled = true;

  try {
    assertWebCryptoAvailable();
    const db = await openDB();
    try {
      if (loginMode === 'setup') {
        const passwordHash = await createPasswordHashRecord(password);
        let decoyPasswordHash = null;
        if (decoyPassword) {
          decoyPasswordHash = await createPasswordHashRecord(decoyPassword);
          await ensureDefaultDecoyFolder(db);
        }
        await saveAppLockSettings(db, { passwordHash, decoyPasswordHash });
        authSessionMode = AUTH_SESSION.REAL;
      } else {
        const appLock = await getAppLockSettings(db);
        if (!isPasswordConfigured(appLock)) {
          configureLoginScreen('setup');
          showLoginError('パスワードが未設定です。新しいパスワードを設定してください。');
          return;
        }
        if (await verifyPassword(password, appLock.passwordHash)) {
          authSessionMode = AUTH_SESSION.REAL;
        } else if (
          isDecoyPasswordConfigured(appLock) &&
          (await verifyPassword(password, appLock.decoyPasswordHash))
        ) {
          authSessionMode = AUTH_SESSION.DECOY;
          await ensureDefaultDecoyFolder(db);
        } else {
          showLoginError('パスワードが正しくありません');
          if (loginPasswordInput) loginPasswordInput.value = '';
          loginPasswordInput?.focus();
          return;
        }
      }
    } finally {
      db.close();
    }

    unlockApp();
    await renderGallery();
  } catch (err) {
    console.error(err);
    showLoginError(err instanceof Error ? err.message : '認証に失敗しました');
  } finally {
    if (loginSubmitBtn) loginSubmitBtn.disabled = false;
  }
}

async function initApp() {
  try {
    assertWebCryptoAvailable();
    const db = await openDB();
    let appLock;
    let hasExistingData = false;
    try {
      appLock = await getAppLockSettings(db);
      const [entries, folders] = await Promise.all([
        getAllEntriesRaw(db),
        getAllFolders(db),
      ]);
      hasExistingData = entries.length > 0 || folders.length > 0;
    } finally {
      db.close();
    }

    if (isPasswordConfigured(appLock)) {
      showLoginScreen('login');
    } else {
      showLoginScreen('setup', hasExistingData);
    }
  } catch (err) {
    console.error(err);
    showLoginScreen('setup');
    showLoginError(err instanceof Error ? err.message : 'アプリの初期化に失敗しました');
  }
}

function bindAuthEvents() {
  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginSubmit);
  }
}

function showDecoySettingsError(message) {
  if (!decoySettingsError) return;
  if (!message) {
    decoySettingsError.hidden = true;
    decoySettingsError.textContent = '';
    return;
  }
  decoySettingsError.hidden = false;
  decoySettingsError.textContent = message;
}

function openDecoySettingsModal() {
  if (isSelectionMode() || isDecoySession()) return;
  closeLightbox();
  closeTextView();
  closeTextModal();
  decoySettingsForm?.reset();
  showDecoySettingsError('');
  showModal(decoySettingsModal);
  document.body.style.overflow = 'hidden';
  decoySettingsPassword?.focus();
}

function closeDecoySettingsModal() {
  if (!decoySettingsModal || decoySettingsModal.hidden) return;
  hideModal(decoySettingsModal);
  showDecoySettingsError('');
  if (lightboxEl.hidden && textViewModal.hidden && textModal.hidden && folderModal.hidden) {
    document.body.style.overflow = '';
  }
}

async function handleDecoySettingsSubmit(event) {
  event.preventDefault();
  showDecoySettingsError('');

  const remove = Boolean(decoySettingsRemove?.checked);
  const password = decoySettingsPassword?.value ?? '';
  const confirmPassword = decoySettingsPasswordConfirm?.value ?? '';

  if (!remove) {
    if (!password || password.length < PASSWORD_MIN_LENGTH) {
      showDecoySettingsError(`デコイパスワードは ${PASSWORD_MIN_LENGTH} 文字以上にしてください`);
      return;
    }
    if (password !== confirmPassword) {
      showDecoySettingsError('デコイパスワード（確認）が一致しません');
      return;
    }
  } else if (password || confirmPassword) {
    showDecoySettingsError('削除する場合はパスワード入力欄を空にしてください');
    return;
  }

  try {
    assertWebCryptoAvailable();
    const db = await openDB();
    try {
      const appLock = await getAppLockSettings(db);
      if (!isPasswordConfigured(appLock)) {
        showDecoySettingsError('本パスワードが未設定です');
        return;
      }

      if (remove) {
        if (!isDecoyPasswordConfigured(appLock)) {
          showDecoySettingsError('デコイパスワードは設定されていません');
          return;
        }
        if (!confirm('デコイパスワードを削除しますか？')) return;
        await saveAppLockSettings(db, { decoyPasswordHash: null });
      } else {
        if (await verifyPassword(password, appLock.passwordHash)) {
          showDecoySettingsError('デコイパスワードは本パスワードと異なるものにしてください');
          return;
        }
        const decoyPasswordHash = await createPasswordHashRecord(password);
        await saveAppLockSettings(db, { decoyPasswordHash });
        await ensureDefaultDecoyFolder(db);
      }
    } finally {
      db.close();
    }

    closeDecoySettingsModal();
    await renderGallery();
    setStatus(remove ? 'デコイパスワードを削除しました' : 'デコイパスワードを保存しました');
  } catch (err) {
    console.error(err);
    showDecoySettingsError(err instanceof Error ? err.message : '保存に失敗しました');
  }
}

function addEntry(db, record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(record);
    let newId;
    request.onsuccess = () => {
      newId = request.result;
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => resolve(newId);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function putEntry(db, record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(record);
    tx.oncomplete = () => resolve(record.id);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function getEntry(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    let result;
    request.onsuccess = () => {
      result = request.result;
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function getAllEntries(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    let result = [];
    request.onsuccess = () => {
      result = request.result.map(normalizeEntry);
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function deleteEntry(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function addFolder(db, record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FOLDERS_STORE, 'readwrite');
    const request = tx.objectStore(FOLDERS_STORE).add(record);
    let newId;
    request.onsuccess = () => {
      newId = request.result;
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => resolve(newId);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function getAllFolders(db) {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(FOLDERS_STORE)) {
      resolve([]);
      return;
    }
    const tx = db.transaction(FOLDERS_STORE, 'readonly');
    const request = tx.objectStore(FOLDERS_STORE).getAll();
    let result = [];
    request.onsuccess = () => {
      result = request.result.map(normalizeFolder);
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function getAllEntriesRaw(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    let result = [];
    request.onsuccess = () => {
      result = request.result;
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function clearObjectStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function putFolderRecord(db, record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FOLDERS_STORE, 'readwrite');
    tx.objectStore(FOLDERS_STORE).put(record);
    tx.oncomplete = () => resolve(record.id);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== 'string' || !dataUrl.includes(',')) {
        reject(new Error('画像データの読み込みに失敗しました'));
        return;
      }
      resolve(dataUrl.split(',')[1]);
    };
    reader.onerror = () => reject(reader.error || new Error('画像データの読み込みに失敗しました'));
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64, mimeType) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType || 'application/octet-stream' });
}

function getEntryTypeFromRecord(entry) {
  if (entry.entryType === ENTRY_TYPE.TEXT) return ENTRY_TYPE.TEXT;
  if (entry.entryType === ENTRY_TYPE.IMAGE) return ENTRY_TYPE.IMAGE;
  if (entry.body !== undefined && entry.body !== null && !entry.blob && !entry.imageData) {
    return ENTRY_TYPE.TEXT;
  }
  return ENTRY_TYPE.IMAGE;
}

function serializeFolderForBackup(folder) {
  const normalized = normalizeFolder(folder);
  return {
    id: normalized.id,
    name: normalized.name,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt,
    isLocked: normalized.isLocked,
    isDecoy: normalized.isDecoy,
    passwordHash: normalized.passwordHash,
  };
}

async function serializeEntryForBackup(entry) {
  const entryType = getEntryTypeFromRecord(entry);
  const createdAt = resolveEntryTimestamp(entry, 'createdAt', 'updatedAt') || Date.now();
  const updatedAt = resolveEntryTimestamp(entry, 'updatedAt', 'createdAt') || createdAt;
  const base = {
    id: entry.id,
    entryType,
    title: entry.title || entry.name || '',
    tags: normalizeTagsList(entry.tags),
    folderId: normalizeFolderId(entry.folderId),
    isFavorite: Boolean(entry.isFavorite),
    favoriteAt: entry.favoriteAt ?? null,
    createdAt,
    updatedAt,
  };

  if (entryType === ENTRY_TYPE.TEXT) {
    base.body = entry.body ?? '';
    return base;
  }

  base.mimeType = entry.mimeType || entry.type || 'image/jpeg';
  if (entry.blob instanceof Blob) {
    base.imageData = await blobToBase64(entry.blob);
  } else if (typeof entry.imageData === 'string' && entry.imageData) {
    base.imageData = entry.imageData;
  } else {
    throw new Error(`画像データがありません (id: ${entry.id})`);
  }
  return base;
}

async function buildBackupPayload() {
  const db = await openDB();
  try {
    const [entries, folders, appLock] = await Promise.all([
      getAllEntriesRaw(db),
      getAllFolders(db),
      getAppLockSettings(db),
    ]);
    const serializedEntries = [];
    for (const entry of entries) {
      serializedEntries.push(await serializeEntryForBackup(entry));
    }
    return {
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      appDbVersion: DB_VERSION,
      folders: folders.map(serializeFolderForBackup),
      entries: serializedEntries,
      appLock: isPasswordConfigured(appLock)
        ? {
            passwordHash: appLock.passwordHash,
            decoyPasswordHash: appLock.decoyPasswordHash ?? null,
            createdAt: appLock.createdAt,
            updatedAt: appLock.updatedAt,
          }
        : null,
    };
  } finally {
    db.close();
  }
}

function formatBackupFilename() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `my-gallery-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
}

function downloadJsonFile(filename, data) {
  const json = JSON.stringify(data);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function exportBackup() {
  setStatus('バックアップを作成中...');
  const payload = await buildBackupPayload();
  downloadJsonFile(formatBackupFilename(), payload);
  const imageCount = payload.entries.filter((e) => e.entryType === ENTRY_TYPE.IMAGE).length;
  const textCount = payload.entries.filter((e) => e.entryType === ENTRY_TYPE.TEXT).length;
  setStatus(
    `バックアップを保存しました（${payload.entries.length} 件 / 画像 ${imageCount} / テキスト ${textCount} / フォルダ ${payload.folders.length}）`
  );
  return payload;
}

function validateBackupPayload(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('バックアップファイルの形式が不正です');
  }
  if (data.format !== BACKUP_FORMAT) {
    throw new Error('My Gallery のバックアップファイルではありません');
  }
  if (data.formatVersion !== BACKUP_FORMAT_VERSION) {
    throw new Error(`未対応のバックアップ形式です (v${data.formatVersion})`);
  }
  if (!Array.isArray(data.entries)) {
    throw new Error('entries が見つかりません');
  }
  if (!Array.isArray(data.folders)) {
    throw new Error('folders が見つかりません');
  }
}

function deserializeFolderFromBackup(data) {
  if (data.id == null || !String(data.name ?? '').trim()) {
    throw new Error('フォルダデータが不正です');
  }
  return normalizeFolder({
    id: data.id,
    name: String(data.name).trim(),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    isLocked: data.isLocked,
    isDecoy: data.isDecoy,
    passwordHash: data.passwordHash,
  });
}

function deserializeEntryFromBackup(data) {
  if (data.id == null) {
    throw new Error('エントリ ID が不正です');
  }

  const entryType = getEntryTypeFromRecord(data);
  const createdAt = resolveEntryTimestamp(data, 'createdAt', 'updatedAt') || Date.now();
  const updatedAt = resolveEntryTimestamp(data, 'updatedAt', 'createdAt') || createdAt;
  const entry = {
    id: data.id,
    entryType,
    title: String(data.title ?? data.name ?? '').trim() || '(無題)',
    tags: normalizeTagsList(data.tags),
    folderId: normalizeFolderId(data.folderId),
    isFavorite: Boolean(data.isFavorite),
    favoriteAt: data.favoriteAt ?? null,
    createdAt,
    updatedAt,
  };

  if (entryType === ENTRY_TYPE.TEXT) {
    entry.body = String(data.body ?? '');
    return entry;
  }

  if (typeof data.imageData !== 'string' || !data.imageData) {
    throw new Error(`画像データがありません (id: ${data.id})`);
  }

  entry.mimeType = data.mimeType || data.type || 'image/jpeg';
  entry.blob = base64ToBlob(data.imageData, entry.mimeType);
  return entry;
}

function summarizeBackupContents(payload) {
  const entries = payload.entries || [];
  const folders = payload.folders || [];
  const imageCount = entries.filter((e) => getEntryTypeFromRecord(e) === ENTRY_TYPE.IMAGE).length;
  const textCount = entries.filter((e) => getEntryTypeFromRecord(e) === ENTRY_TYPE.TEXT).length;
  return { imageCount, textCount, total: entries.length, folders: folders.length };
}

function summarizeCurrentContents() {
  const imageCount = cachedEntries.filter((e) => isImageEntry(e)).length;
  const textCount = cachedEntries.filter((e) => isTextEntry(e)).length;
  return {
    imageCount,
    textCount,
    total: cachedEntries.length,
    folders: cachedFolders.length,
  };
}

async function restoreBackup(payload) {
  validateBackupPayload(payload);

  const folders = payload.folders.map(deserializeFolderFromBackup);
  const entries = payload.entries.map(deserializeEntryFromBackup);

  const db = await openDB();
  try {
    await clearObjectStore(db, STORE_NAME);
    if (db.objectStoreNames.contains(FOLDERS_STORE)) {
      await clearObjectStore(db, FOLDERS_STORE);
    }

    for (const folder of folders) {
      await putFolderRecord(db, folder);
    }
    for (const entry of entries) {
      await putEntry(db, entry);
    }

    if (payload.appLock?.passwordHash && db.objectStoreNames.contains(SETTINGS_STORE)) {
      await putSetting(db, {
        id: APP_LOCK_ID,
        passwordHash: payload.appLock.passwordHash,
        decoyPasswordHash: payload.appLock.decoyPasswordHash ?? null,
        createdAt: payload.appLock.createdAt ?? Date.now(),
        updatedAt: payload.appLock.updatedAt ?? Date.now(),
      });
    }
  } finally {
    db.close();
  }

  selectedFolderId = null;
  exitAllSelectionModes();
  closeAllModalsForSelectionMode();
}

async function handleExportBackup() {
  if (isDecoySession()) {
    setStatus('バックアップできません');
    return;
  }
  if (isSelectionMode()) {
    setStatus('選択モード中はバックアップできません。キャンセルしてから実行してください。');
    return;
  }

  try {
    await exportBackup();
  } catch (err) {
    console.error(err);
    setStatus('バックアップの作成に失敗しました');
  }
}

async function handleImportBackupFile(file) {
  if (!file) return;

  if (isDecoySession()) {
    setStatus('復元できません');
    return;
  }

  if (isSelectionMode()) {
    setStatus('選択モード中は復元できません。キャンセルしてから実行してください。');
    return;
  }

  try {
    setStatus('バックアップファイルを読み込み中...');
    const text = await file.text();
    const payload = JSON.parse(text);
    validateBackupPayload(payload);

    const backup = summarizeBackupContents(payload);
    const current = summarizeCurrentContents();
    const exportedAt = payload.exportedAt
      ? new Date(payload.exportedAt).toLocaleString('ja-JP')
      : '不明';

    const message =
      `現在のデータ（${current.total} 件 / 画像 ${current.imageCount} / テキスト ${current.textCount} / フォルダ ${current.folders}）をすべて削除し、` +
      `バックアップ（${backup.total} 件 / 画像 ${backup.imageCount} / テキスト ${backup.textCount} / フォルダ ${backup.folders}）で置き換えます。\n\n` +
      `バックアップ作成日時: ${exportedAt}\n\n` +
      'この操作は取り消せません。続行しますか？';

    if (!confirm(message)) {
      setStatus('復元をキャンセルしました');
      return;
    }

    setStatus('復元中...');
    await restoreBackup(payload);
    await renderGallery();
    setStatus(
      `復元が完了しました（${backup.total} 件 / 画像 ${backup.imageCount} / テキスト ${backup.textCount} / フォルダ ${backup.folders}）`
    );
  } catch (err) {
    console.error(err);
    setStatus(err instanceof Error ? err.message : '復元に失敗しました');
  } finally {
    if (importBackupInput) importBackupInput.value = '';
  }
}

async function createFolder(name, { isDecoy = false } = {}) {
  const trimmed = String(name).trim();
  if (!trimmed) throw new Error('フォルダ名を入力してください');

  const folderIsDecoy = isDecoySession() ? true : Boolean(isDecoy);
  const db = await openDB();
  try {
    const id = await addFolder(db, createFolderRecord(trimmed, { isDecoy: folderIsDecoy }));
    cachedFolders = await getAllFolders(db);
    return id;
  } finally {
    db.close();
  }
}

function countAllEntriesInFolder(folderId) {
  const id = normalizeFolderId(folderId);
  if (id == null) return 0;
  return cachedEntries.filter((entry) => normalizeFolderId(entry.folderId) === id).length;
}

async function deleteFolderById(folderId) {
  const id = normalizeFolderId(folderId);
  if (id == null) throw new Error('フォルダ ID が不正です');

  const db = await openDB();
  const movedEntries = [];
  const now = Date.now();

  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME, FOLDERS_STORE], 'readwrite');
      const entryStore = tx.objectStore(STORE_NAME);
      const folderStore = tx.objectStore(FOLDERS_STORE);
      const request = entryStore.index('folderId').getAll(id);

      request.onsuccess = () => {
        for (const entry of request.result || []) {
          entry.folderId = null;
          entry.updatedAt = now;
          entryStore.put(entry);
          movedEntries.push(normalizeEntry(entry));
        }
        folderStore.delete(id);
      };
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }

  for (const updated of movedEntries) {
    updateCachedEntry(updated);
    updateCardInGallery(updated);
  }

  cachedFolders = cachedFolders.filter((folder) => folder.id !== id);

  if (selectedFolderId === id) {
    selectedFolderId = null;
  }

  renderFolderList();
  applyGalleryFilter();

  if (isMoveMode && moveTargetSelect) {
    populateFolderSelect(moveTargetSelect, moveTargetSelect.value);
  }

  if (detailEntry && normalizeFolderId(detailEntry.folderId) === id) {
    detailEntry = { ...detailEntry, folderId: null, updatedAt: now };
  }

  return movedEntries.length;
}

async function handleDeleteFolder(folderId) {
  if (isSelectionMode()) {
    setStatus('選択モード中はフォルダを削除できません。キャンセルしてから実行してください。');
    return;
  }

  const folder = getFolderById(folderId);
  if (!folder || !folderVisibleInSession(folder)) return;

  const itemCount = countAllEntriesInFolder(folder.id);
  const message =
    itemCount > 0
      ? `「${folder.name}」を削除しますか？\n\nフォルダ内の ${itemCount} 件は削除されず、未分類に移動します。`
      : `「${folder.name}」を削除しますか？`;

  if (!confirm(message)) return;

  try {
    setStatus('フォルダを削除中...');
    const movedCount = await deleteFolderById(folder.id);
    if (movedCount > 0) {
      setStatus(`「${folder.name}」を削除しました（${movedCount} 件を未分類へ移動）`);
    } else {
      setStatus(`「${folder.name}」を削除しました`);
    }
  } catch (err) {
    console.error(err);
    setStatus('フォルダの削除に失敗しました');
  }
}

function populateFolderSelect(selectEl, selectedId) {
  selectEl.innerHTML = '';
  const noneOption = document.createElement('option');
  noneOption.value = '';
  noneOption.textContent = 'なし（未分類）';
  selectEl.appendChild(noneOption);

  for (const folder of cachedFolders) {
    if (!folderVisibleInSession(folder)) continue;
    const option = document.createElement('option');
    option.value = String(folder.id);
    option.textContent = folder.name;
    selectEl.appendChild(option);
  }

  const normalized = normalizeFolderId(selectedId);
  selectEl.value = normalized != null ? String(normalized) : '';
}

function renderFolderList() {
  if (!folderListEl) return;
  folderListEl.innerHTML = '';

  const allLi = document.createElement('li');
  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.className = 'folder-item';
  allBtn.dataset.folderId = '';
  if (selectedFolderId == null) allBtn.classList.add('is-active');
  allBtn.appendChild(document.createTextNode('すべて表示 '));
  const allCount = document.createElement('span');
  allCount.className = 'folder-item-count';
  allCount.textContent = String(getSessionEntries().length);
  allBtn.appendChild(allCount);
  allBtn.addEventListener('click', () => selectFolder(null));
  allLi.appendChild(allBtn);
  folderListEl.appendChild(allLi);

  const sorted = [...cachedFolders]
    .filter(folderVisibleInSession)
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  for (const folder of sorted) {
    const li = document.createElement('li');
    li.className = 'folder-list-item';

    const row = document.createElement('div');
    row.className = 'folder-item-row';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'folder-item';
    btn.dataset.folderId = String(folder.id);
    if (selectedFolderId === folder.id) btn.classList.add('is-active');
    btn.appendChild(document.createTextNode(`${folder.name} `));
    const count = document.createElement('span');
    count.className = 'folder-item-count';
    count.textContent = String(countEntriesInFolder(folder.id));
    btn.appendChild(count);
    btn.addEventListener('click', () => selectFolder(folder.id));

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'folder-delete-btn';
    deleteBtn.setAttribute('aria-label', `「${folder.name}」を削除`);
    deleteBtn.title = 'フォルダを削除';
    deleteBtn.textContent = '×';
    deleteBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      handleDeleteFolder(folder.id);
    });

    row.appendChild(btn);
    row.appendChild(deleteBtn);
    li.appendChild(row);
    folderListEl.appendChild(li);
  }
}

function selectFolder(folderId) {
  selectedFolderId = normalizeFolderId(folderId);
  renderFolderList();
  applyGalleryFilter();
}

function openFolderModal() {
  if (isSelectionMode()) return;
  closeLightbox();
  closeTextView();
  closeTextModal();
  folderForm?.reset();
  if (folderDecoyField) {
    folderDecoyField.hidden = isDecoySession();
  }
  if (folderDecoyCheckbox) {
    folderDecoyCheckbox.checked = isDecoySession();
  }
  showModal(folderModal);
  document.body.style.overflow = 'hidden';
  folderNameInput?.focus();
}

function closeFolderModal() {
  if (!folderModal || folderModal.hidden) return;
  hideModal(folderModal);
  if (lightboxEl.hidden && textViewModal.hidden && textModal.hidden) {
    document.body.style.overflow = '';
  }
}

/** 将来の検索: タグ名でエントリを取得 */
async function getEntriesByTag(tagName) {
  const normalized = normalizeTagName(tagName);
  if (!normalized) return [];

  const db = await openDB();
  const store = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME);
  const index = store.index('tags');

  const results = await new Promise((resolve, reject) => {
    const request = index.getAll(normalized);
    request.onsuccess = () => resolve(request.result.map(normalizeEntry));
    request.onerror = () => reject(request.error);
  });

  db.close();
  return results;
}

async function updateEntry(id, changes) {
  if (id == null || id === '') {
    throw new Error('保存対象のIDが不正です');
  }

  const db = await openDB();

  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);
      let updatedEntry = null;

      request.onsuccess = () => {
        const entry = request.result;
        if (!entry) return;

        if (changes.title !== undefined) {
          const title = String(changes.title).trim();
          if (!title) return;
          entry.title = title;
          delete entry.name;
        }
        if (changes.tags !== undefined) {
          entry.tags = normalizeTagsList(changes.tags);
        }
        if (changes.body !== undefined && entry.entryType === ENTRY_TYPE.TEXT) {
          entry.body = changes.body;
        }
        if (changes.isFavorite !== undefined) {
          entry.isFavorite = Boolean(changes.isFavorite);
          entry.favoriteAt = entry.isFavorite ? Date.now() : null;
        }
        if (changes.folderId !== undefined) {
          entry.folderId = normalizeFolderId(changes.folderId);
        }

        if (entry.isFavorite === undefined) entry.isFavorite = false;
        if (entry.favoriteAt === undefined) {
          entry.favoriteAt = entry.isFavorite
            ? entry.updatedAt || entry.createdAt || Date.now()
            : null;
        }
        if (entry.folderId === undefined) entry.folderId = null;

        entry.updatedAt = Date.now();
        store.put(entry);
        updatedEntry = normalizeEntry(entry);
      };

      request.onerror = () => reject(request.error);

      tx.oncomplete = () => {
        if (updatedEntry) {
          resolve(updatedEntry);
        } else {
          reject(new Error('エントリが見つかりません'));
        }
      };

      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

// --- 保存 ---

async function saveFiles(files) {
  const db = await openDB();
  let count = 0;
  let targetFolderId = getTargetFolderIdForNewEntry();

  if (isDecoySession() && targetFolderId == null) {
    await ensureDefaultDecoyFolder(db);
    cachedFolders = await getAllFolders(db);
    targetFolderId = getDefaultDecoyFolderId();
  }

  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const record = createImageRecord(file);
    if (targetFolderId != null) record.folderId = targetFolderId;
    await addEntry(db, record);
    count++;
  }

  db.close();
  return count;
}

async function saveText(title, body) {
  const db = await openDB();
  let targetFolderId = getTargetFolderIdForNewEntry();

  if (isDecoySession() && targetFolderId == null) {
    await ensureDefaultDecoyFolder(db);
    targetFolderId = getDefaultDecoyFolderId();
  }

  const record = createTextRecord(title.trim(), body);
  if (targetFolderId != null) record.folderId = targetFolderId;
  await addEntry(db, record);
  db.close();
}

// --- タグ UI ---

function createCardTagsElement(tags) {
  const list = normalizeTagsList(tags);
  if (list.length === 0) return null;

  const wrap = document.createElement('div');
  wrap.className = 'card-tags';

  const visible = list.slice(0, 3);
  for (const tag of visible) {
    const span = document.createElement('span');
    span.className = 'card-tag';
    span.textContent = tag;
    wrap.appendChild(span);
  }

  if (list.length > 3) {
    const more = document.createElement('span');
    more.className = 'card-tag card-tag--more';
    more.textContent = `+${list.length - 3}`;
    wrap.appendChild(more);
  }

  return wrap;
}

function updateCardInGallery(entry) {
  const li = galleryEl.querySelector(`li[data-entry-id="${entry.id}"]`);
  if (!li) return;

  const nameEl = li.querySelector('.name');
  if (nameEl) nameEl.textContent = getEntryLabel(entry);

  li.querySelector('.card-tags')?.remove();
  const tagsEl = createCardTagsElement(entry.tags);
  if (tagsEl) li.appendChild(tagsEl);

  const preview = li.querySelector('.card-text-preview');
  if (preview && isTextEntry(entry)) {
    preview.textContent = entry.body || '';
  }

  const img = li.querySelector('img');
  if (img) img.alt = getEntryLabel(entry);

  li.querySelector('.card-folder')?.remove();
  const folderName = getFolderName(entry.folderId);
  if (folderName) {
    const folderEl = document.createElement('div');
    folderEl.className = 'card-folder';
    folderEl.textContent = `📁 ${folderName}`;
    const nameEl = li.querySelector('.name');
    if (nameEl) nameEl.insertAdjacentElement('afterend', folderEl);
  }
}

function createTagsDisplayElement(tags) {
  const list = normalizeTagsList(tags);
  if (list.length === 0) return null;

  const wrap = document.createElement('div');
  wrap.className = 'detail-tags-display';
  for (const tag of list) {
    const span = document.createElement('span');
    span.className = 'detail-tag-readonly';
    span.textContent = tag;
    wrap.appendChild(span);
  }
  return wrap;
}

/**
 * 詳細画面の閲覧・編集 UI
 * @param {HTMLElement} container
 * @param {object} entry
 * @param {{ variant?: 'light'|'dark', showBody?: boolean, onSaved?: Function }} options
 */
function mountEntryEditor(container, entry, options = {}) {
  if (!container) return null;

  const entryId = entry?.id;
  if (entryId == null) {
    container.innerHTML = '<p class="detail-save-status">編集できません（データIDがありません）</p>';
    return null;
  }

  const { variant = 'light', showBody = false, onSaved } = options;
  let mode = 'view';
  let editingTags = [...getEntryTags(entry)];

  container.innerHTML = '';
  container.onclick = (e) => e.stopPropagation();

  const viewEl = document.createElement('div');
  viewEl.className = 'detail-view';

  const editEl = document.createElement('div');
  editEl.className = 'detail-edit';
  editEl.hidden = true;

  const titleField = document.createElement('label');
  titleField.className = 'field';
  titleField.innerHTML = '<span>タイトル</span>';
  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.maxLength = 200;
  titleInput.required = true;
  titleInput.autocomplete = 'off';
  titleField.appendChild(titleInput);

  let bodyField = null;
  let bodyInput = null;
  if (showBody) {
    bodyField = document.createElement('label');
    bodyField.className = 'field';
    bodyField.innerHTML = '<span>本文</span>';
    bodyInput = document.createElement('textarea');
    bodyInput.rows = 8;
    bodyInput.required = true;
    bodyField.appendChild(bodyInput);
  }

  const folderField = document.createElement('label');
  folderField.className = 'field';
  folderField.innerHTML = '<span>フォルダ</span>';
  const folderSelect = document.createElement('select');
  folderSelect.setAttribute('aria-label', '所属フォルダ');
  folderField.appendChild(folderSelect);

  const tagHeading = document.createElement('h3');
  tagHeading.className = 'tag-editor-heading';
  tagHeading.textContent = 'タグ';

  const chipList = document.createElement('div');
  chipList.className = 'tag-chip-list';

  const tagInputRow = document.createElement('div');
  tagInputRow.className = 'tag-input-row';
  const tagInput = document.createElement('input');
  tagInput.type = 'text';
  tagInput.placeholder = '例: 旅行, メモ';
  tagInput.maxLength = 50;
  tagInput.setAttribute('aria-label', 'タグを入力');
  const tagAddBtn = document.createElement('button');
  tagAddBtn.type = 'button';
  tagAddBtn.className = 'btn-tag-add';
  tagAddBtn.textContent = '追加';
  tagInputRow.appendChild(tagInput);
  tagInputRow.appendChild(tagAddBtn);

  const editActions = document.createElement('div');
  editActions.className = 'detail-edit-actions';
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn btn-outline';
  cancelBtn.textContent = 'キャンセル';
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn btn-primary';
  saveBtn.textContent = '保存';
  editActions.appendChild(cancelBtn);
  editActions.appendChild(saveBtn);

  const saveStatus = document.createElement('p');
  saveStatus.className = 'detail-save-status';
  saveStatus.setAttribute('aria-live', 'polite');

  editEl.appendChild(titleField);
  if (bodyField) editEl.appendChild(bodyField);
  editEl.appendChild(folderField);
  editEl.appendChild(tagHeading);
  editEl.appendChild(chipList);
  editEl.appendChild(tagInputRow);
  editEl.appendChild(editActions);
  editEl.appendChild(saveStatus);

  container.appendChild(viewEl);
  container.appendChild(editEl);

  function renderTagChips() {
    chipList.innerHTML = '';
    for (const tag of editingTags) {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';

      const label = document.createElement('span');
      label.textContent = tag;

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'tag-chip-remove';
      removeBtn.setAttribute('aria-label', `${tag} を削除`);
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => {
        editingTags = editingTags.filter((t) => t !== tag);
        renderTagChips();
      });

      chip.appendChild(label);
      chip.appendChild(removeBtn);
      chipList.appendChild(chip);
    }
  }

  function addTagsFromInput() {
    const added = parseTagInput(tagInput.value);
    if (added.length === 0) return;
    editingTags = normalizeTagsList([...editingTags, ...added]);
    tagInput.value = '';
    renderTagChips();
  }

  tagAddBtn.addEventListener('click', addTagsFromInput);
  tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTagsFromInput();
    }
  });

  function renderView() {
    viewEl.innerHTML = '';

    const title = document.createElement('h2');
    title.className = 'detail-title';
    title.textContent = getEntryLabel(entry);
    viewEl.appendChild(title);

    if (showBody) {
      const body = document.createElement('div');
      body.className = 'detail-body';
      body.textContent = entry.body || '';
      viewEl.appendChild(body);
    }

    const folderName = getFolderName(entry.folderId);
    const folderLine = document.createElement('p');
    folderLine.className = 'detail-folder';
    folderLine.textContent = folderName ? `📁 ${folderName}` : '📁 未分類';
    viewEl.appendChild(folderLine);

    const tagsDisplay = createTagsDisplayElement(entry.tags);
    if (tagsDisplay) viewEl.appendChild(tagsDisplay);

    const updated = document.createElement('p');
    updated.className = 'detail-updated';
    updated.textContent = formatUpdatedAt(entry.updatedAt);
    viewEl.appendChild(updated);

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn-outline detail-edit-btn';
    editBtn.textContent = '編集';
    editBtn.addEventListener('click', () => setMode('edit'));
    viewEl.appendChild(editBtn);
  }

  function fillEditForm() {
    titleInput.value = getEntryLabel(entry);
    if (bodyInput) bodyInput.value = entry.body || '';
    populateFolderSelect(folderSelect, entry.folderId);
    editingTags = [...getEntryTags(entry)];
    renderTagChips();
    saveStatus.textContent = '';
  }

  function setMode(nextMode) {
    mode = nextMode;
    viewEl.hidden = mode === 'edit';
    editEl.hidden = mode === 'view';
    if (mode === 'edit') {
      fillEditForm();
      titleInput.focus();
    }
  }

  cancelBtn.addEventListener('click', () => setMode('view'));

  saveBtn.addEventListener('click', async () => {
    const title = titleInput.value.trim();
    if (!title) {
      saveStatus.textContent = 'タイトルを入力してください';
      titleInput.focus();
      return;
    }

    const changes = {
      title,
      tags: editingTags,
      folderId: folderSelect.value === '' ? null : Number(folderSelect.value),
    };
    if (showBody && bodyInput) {
      changes.body = bodyInput.value;
    }

    try {
      saveBtn.disabled = true;
      cancelBtn.disabled = true;
      saveStatus.textContent = '保存中...';

      const updated = await updateEntry(entryId, changes);
      Object.assign(entry, updated);
      detailEntry = updated;
      updateCachedEntry(updated);
      updateCardInGallery(updated);
      renderFolderList();
      applyGalleryFilter();
      renderView();
      setMode('view');
      saveStatus.textContent = '';
      onSaved?.(updated);
    } catch (err) {
      console.error(err);
      saveStatus.textContent = '保存に失敗しました';
    } finally {
      saveBtn.disabled = false;
      cancelBtn.disabled = false;
    }
  });

  renderView();
  setMode('view');

  return {
    isEditing() {
      return mode === 'edit';
    },
    cancelEdit() {
      setMode('view');
    },
    refresh(entryRef) {
      Object.assign(entry, normalizeEntry(entryRef));
      renderView();
      if (mode === 'edit') fillEditForm();
    },
    destroy() {
      container.innerHTML = '';
    },
  };
}

// --- お気に入り ---

function syncFavoriteButton(btn, entry) {
  if (!btn) return;
  const active = Boolean(entry.isFavorite);
  btn.classList.toggle('is-active', active);
  btn.setAttribute('aria-pressed', String(active));
  btn.setAttribute('aria-label', active ? 'お気に入り解除' : 'お気に入りに追加');
}

function syncCardFavoriteLook(entryId, isFavorite) {
  const li = galleryEl.querySelector(`li[data-entry-id="${entryId}"]`);
  if (!li) return;
  li.classList.toggle('is-favorite', isFavorite);
  syncFavoriteButton(li.querySelector('.favorite-btn'), { isFavorite });
}

function createFavoriteButton(entry) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'favorite-btn';
  btn.textContent = '⭐';
  syncFavoriteButton(btn, entry);

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFavorite(entry.id, btn);
  });

  return btn;
}

async function toggleFavorite(id, btn) {
  const entry = cachedEntries.find((e) => e.id === id);
  if (!entry) return;

  const next = !entry.isFavorite;
  if (btn) btn.disabled = true;

  try {
    const updated = await updateEntry(id, { isFavorite: next });
    updateCachedEntry(updated);
    syncCardFavoriteLook(id, updated.isFavorite);
    if (detailEntry?.id === id) {
      detailEntry = updated;
    }
    applyGalleryFilter();
  } catch (err) {
    console.error(err);
    setStatus('お気に入りの更新に失敗しました');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// --- 一覧表示 ---

function revokeActiveUrls() {
  for (const url of activeUrls) {
    URL.revokeObjectURL(url);
  }
  activeUrls.clear();
}

function createCheckboxOverlay(item, label) {
  const overlay = document.createElement('label');
  overlay.className = 'card-checkbox-overlay';
  overlay.hidden = !isSelectionMode();

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'card-checkbox';
  checkbox.value = String(item.id);
  checkbox.checked = selectedIds.has(item.id);
  checkbox.setAttribute('aria-label', `${label} を選択`);

  overlay.appendChild(checkbox);
  overlay.setAttribute('aria-pressed', String(checkbox.checked));

  checkbox.addEventListener('change', () => {
    onSelectionChange(item.id, checkbox.checked);
    overlay.setAttribute('aria-pressed', String(checkbox.checked));
  });

  checkbox.addEventListener('click', (e) => e.stopPropagation());

  return overlay;
}

function syncCardSelectionLook(entryId, selected) {
  const li = galleryEl.querySelector(`li[data-entry-id="${entryId}"]`);
  if (!li) return;
  li.classList.toggle('is-selected', selected);
  const checkbox = li.querySelector('.card-checkbox');
  if (checkbox) checkbox.checked = selected;
  const overlay = li.querySelector('.card-checkbox-overlay');
  if (overlay) overlay.setAttribute('aria-pressed', String(selected));
}

function appendCardMeta(li, item) {
  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = getEntryLabel(item);
  li.appendChild(name);

  const folderName = getFolderName(item.folderId);
  if (folderName) {
    const folderEl = document.createElement('div');
    folderEl.className = 'card-folder';
    folderEl.textContent = `📁 ${folderName}`;
    li.appendChild(folderEl);
  }

  const tagsEl = createCardTagsElement(item.tags);
  if (tagsEl) {
    li.appendChild(tagsEl);
  }
}

function renderImageCard(item) {
  const entry = normalizeEntry(item);
  const url = URL.createObjectURL(entry.blob);
  activeUrls.add(url);

  const li = document.createElement('li');
  li.className = 'is-image';
  if (entry.isFavorite) li.classList.add('is-favorite');
  li.dataset.entryType = ENTRY_TYPE.IMAGE;
  li.dataset.entryId = String(entry.id);

  const imageWrap = document.createElement('div');
  imageWrap.className = 'card-image-wrap';

  const badge = document.createElement('span');
  badge.className = 'card-badge';
  badge.textContent = '画像';

  const checkboxOverlay = createCheckboxOverlay(entry, getEntryLabel(entry));
  const favoriteBtn = createFavoriteButton(entry);

  const img = document.createElement('img');
  img.src = url;
  img.alt = getEntryLabel(entry);
  img.title = isSelectionMode() ? '' : 'ダブルクリックで拡大';
  if (!isSelectionMode()) {
    img.addEventListener('dblclick', () => openLightbox(entry, url));
  }

  imageWrap.appendChild(favoriteBtn);
  imageWrap.appendChild(badge);
  imageWrap.appendChild(img);
  if (selectedIds.has(entry.id)) li.classList.add('is-selected');
  li.appendChild(checkboxOverlay);
  li.appendChild(imageWrap);
  appendCardMeta(li, entry);

  return li;
}

function renderTextCard(item) {
  const entry = normalizeEntry(item);

  const li = document.createElement('li');
  li.className = 'is-text';
  if (entry.isFavorite) li.classList.add('is-favorite');
  li.dataset.entryType = ENTRY_TYPE.TEXT;
  li.dataset.entryId = String(entry.id);

  const textWrap = document.createElement('div');
  textWrap.className = 'card-text-wrap';

  const badge = document.createElement('span');
  badge.className = 'card-badge card-badge--text';
  badge.textContent = 'テキスト';

  const checkboxOverlay = createCheckboxOverlay(entry, getEntryLabel(entry));
  const favoriteBtn = createFavoriteButton(entry);

  const preview = document.createElement('p');
  preview.className = 'card-text-preview';
  preview.textContent = entry.body;

  textWrap.appendChild(favoriteBtn);
  textWrap.appendChild(badge);
  textWrap.appendChild(preview);
  if (selectedIds.has(entry.id)) li.classList.add('is-selected');
  li.appendChild(checkboxOverlay);
  li.appendChild(textWrap);
  appendCardMeta(li, entry);

  if (!isSelectionMode()) {
    li.classList.add('card-clickable');
    li.title = 'クリックで全文表示';
    li.addEventListener('click', (e) => {
      if (e.target.closest('.card-checkbox, .favorite-btn')) return;
      openTextView(entry);
    });
  }

  return li;
}

// --- 選択モード（削除 / フォルダ移動） ---

function updateSelectionModeUI() {
  document.body.classList.toggle('delete-mode', isDeleteMode);
  document.body.classList.toggle('move-mode', isMoveMode);
  enterDeleteModeBtn.hidden = isDeleteMode;
  enterMoveModeBtn.hidden = isMoveMode;
  deleteModeBar.hidden = !isDeleteMode;
  moveModeBar.hidden = !isMoveMode;

  const countLabel = `${selectedIds.size} 件選択中`;
  selectionCountEl.textContent = countLabel;
  moveSelectionCountEl.textContent = countLabel;
  deleteSelectedBtn.disabled = selectedIds.size === 0;
  moveSelectedBtn.disabled = selectedIds.size === 0;
}

function exitAllSelectionModes() {
  isDeleteMode = false;
  isMoveMode = false;
  selectedIds.clear();
  updateSelectionModeUI();
}

function enterDeleteMode() {
  exitAllSelectionModes();
  isDeleteMode = true;
  closeAllModalsForSelectionMode();
  updateSelectionModeUI();
  renderGallery();
}

function exitDeleteMode() {
  if (!isDeleteMode) return;
  isDeleteMode = false;
  selectedIds.clear();
  updateSelectionModeUI();
  renderGallery();
}

function enterMoveMode() {
  exitAllSelectionModes();
  isMoveMode = true;
  closeAllModalsForSelectionMode();
  if (moveTargetSelect) {
    populateFolderSelect(moveTargetSelect, selectedFolderId);
  }
  updateSelectionModeUI();
  renderGallery();
}

function exitMoveMode() {
  if (!isMoveMode) return;
  isMoveMode = false;
  selectedIds.clear();
  updateSelectionModeUI();
  renderGallery();
}

function onSelectionChange(id, checked) {
  if (checked) {
    selectedIds.add(id);
  } else {
    selectedIds.delete(id);
  }
  syncCardSelectionLook(id, checked);
  updateSelectionModeUI();
}

async function moveEntriesToFolder(ids, folderId) {
  const targetFolderId = normalizeFolderId(folderId);
  for (const id of ids) {
    const updated = await updateEntry(id, { folderId: targetFolderId });
    updateCachedEntry(updated);
  }
}

function getMoveTargetLabel() {
  if (!moveTargetSelect) return '未分類';
  const folderId = normalizeFolderId(moveTargetSelect.value);
  if (folderId == null) return '未分類';
  return getFolderName(folderId) || '選択中のフォルダ';
}

async function handleMoveSelected() {
  if (selectedIds.size === 0) return;

  const count = selectedIds.size;
  const targetLabel = getMoveTargetLabel();
  const message = `選択した ${count} 件を「${targetLabel}」に移動しますか？`;
  if (!confirm(message)) return;

  const idsToMove = [...selectedIds];
  const folderId = moveTargetSelect ? normalizeFolderId(moveTargetSelect.value) : null;

  try {
    setStatus('移動中...');
    await moveEntriesToFolder(idsToMove, folderId);
    exitMoveMode();
    setStatus(`${count} 件を移動しました`);
  } catch (err) {
    console.error(err);
    setStatus('移動に失敗しました');
  }
}

async function removeEntries(ids) {
  const db = await openDB();
  for (const id of ids) {
    await deleteEntry(db, id);
  }
  db.close();
}

async function handleDeleteSelected() {
  if (selectedIds.size === 0) return;

  const count = selectedIds.size;
  const message = `選択した ${count} 件を削除しますか？\nこの操作は取り消せません。`;
  if (!confirm(message)) return;

  const idsToDelete = [...selectedIds];

  try {
    setStatus('削除中...');
    await removeEntries(idsToDelete);
    exitDeleteMode();
    setStatus(`${count} 件を削除しました`);
  } catch (err) {
    console.error(err);
    setStatus('削除に失敗しました');
  }
}

// --- 画像詳細 ---

async function openLightbox(item, url) {
  if (isSelectionMode()) return;

  const entry = await loadEntryForDetail(item);
  if (!entry) {
    setStatus('データの読み込みに失敗しました');
    return;
  }

  detailEntry = entry;

  closeTextView();
  closeTextModal();
  closeFolderModal();
  lightboxImg.src = url;
  lightboxImg.alt = getEntryLabel(entry);
  lightboxEl.hidden = false;
  lightboxEl.removeAttribute('hidden');
  document.body.style.overflow = 'hidden';

  lightboxDetailController = mountEntryEditor(lightboxDetail, entry, {
    variant: 'dark',
    showBody: false,
    onSaved: (updated) => {
      detailEntry = updated;
      lightboxImg.alt = getEntryLabel(updated);
    },
  });

  lightboxClose.focus();
}

function closeLightbox() {
  if (lightboxEl.hidden) return;
  lightboxEl.hidden = true;
  lightboxEl.setAttribute('hidden', '');
  lightboxImg.removeAttribute('src');
  detailEntry = null;
  lightboxDetailController?.destroy();
  lightboxDetailController = null;
  if (lightboxEl.hidden && textViewModal.hidden && textModal.hidden && folderModal.hidden) {
    document.body.style.overflow = '';
  }
}

function showModal(el) {
  el.hidden = false;
  el.removeAttribute('hidden');
}

function hideModal(el) {
  el.hidden = true;
  el.setAttribute('hidden', '');
}

function openTextModal() {
  if (isSelectionMode()) return;
  if (!textModal || !textForm) {
    console.error('テキストモーダルの要素が見つかりません');
    return;
  }

  closeLightbox();
  closeTextView();
  closeTextModal();
  closeFolderModal();
  textForm.reset();
  showModal(textModal);
  document.body.style.overflow = 'hidden';
  textTitleInput.focus();
}

function closeTextModal() {
  if (!textModal || textModal.hidden) return;
  hideModal(textModal);
  if (lightboxEl.hidden && textViewModal.hidden && folderModal.hidden) {
    document.body.style.overflow = '';
  }
}

async function openTextView(item) {
  if (isSelectionMode()) return;
  if (!textViewModal || !textViewDetail) {
    console.error('テキスト閲覧モーダルの要素が見つかりません');
    return;
  }

  const entry = await loadEntryForDetail(item);
  if (!entry) {
    setStatus('データの読み込みに失敗しました');
    return;
  }

  detailEntry = entry;

  closeLightbox();
  closeTextModal();
  closeFolderModal();
  showModal(textViewModal);
  document.body.style.overflow = 'hidden';

  textViewDetailController = mountEntryEditor(textViewDetail, entry, {
    variant: 'light',
    showBody: true,
    onSaved: (updated) => {
      detailEntry = updated;
    },
  });

  (textViewCloseBtn || textViewClose).focus();
}

/** 詳細表示用に IndexedDB から最新データを取得 */
async function loadEntryForDetail(item) {
  const id = item?.id;
  if (id == null) return normalizeEntry(item);

  const db = await openDB();
  try {
    const entry = await getEntry(db, id);
    return entry ? normalizeEntry(entry) : normalizeEntry(item);
  } finally {
    db.close();
  }
}

function closeTextView() {
  if (!textViewModal || textViewModal.hidden) return;
  hideModal(textViewModal);
  detailEntry = null;
  textViewDetailController?.destroy();
  textViewDetailController = null;
  if (lightboxEl.hidden && textModal.hidden && folderModal.hidden) {
    document.body.style.overflow = '';
  }
}

async function renderGallery() {
  closeLightbox();
  closeTextView();
  revokeActiveUrls();
  galleryEl.innerHTML = '';

  const db = await openDB();
  cachedEntries = await getAllEntries(db);
  cachedFolders = await getAllFolders(db);
  db.close();

  if (selectedFolderId != null) {
    const folder = getFolderById(selectedFolderId);
    if (!folder || !folderVisibleInSession(folder)) {
      selectedFolderId = null;
    }
  }

  updateSessionUI();
  renderFolderList();

  const sessionEntries = getSessionEntries();
  if (sessionEntries.length === 0) {
    if (isSelectionMode()) {
      exitAllSelectionModes();
    }
    updateGalleryStatus(getScopeEntries(), [], searchInput?.value ?? '');
    updateSelectionModeUI();
    return;
  }

  const sorted = sortEntries(sessionEntries);
  for (const item of sorted) {
    const card = isTextEntry(item) ? renderTextCard(item) : renderImageCard(item);
    galleryEl.appendChild(card);
  }

  updateSelectionModeUI();
  applyGalleryFilter();
}

function setStatus(message) {
  statusEl.textContent = message;
}

// --- イベント ---

function bindEvents() {
  if (!addTextBtn) {
    console.error('#addTextBtn が見つかりません');
  } else {
    addTextBtn.addEventListener('click', openTextModal);
  }

  lightboxClose.addEventListener('click', closeLightbox);
  textModalCancel.addEventListener('click', closeTextModal);
  textViewClose.addEventListener('click', closeTextView);
  if (textViewCloseBtn) {
    textViewCloseBtn.addEventListener('click', closeTextView);
  }

  if (searchInput) {
    searchInput.addEventListener('input', applyGalleryFilter);
  }

  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      applyGalleryFilter();
      searchInput?.focus();
    });
  }

  if (favoritesOnlyFilter) {
    favoritesOnlyFilter.addEventListener('change', () => {
      showFavoritesOnly = favoritesOnlyFilter.checked;
      applyGalleryFilter();
    });
  }

  initSortSelect();

  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      sortMode = isValidSortMode(sortSelect.value) ? sortSelect.value : SORT_MODE.NEWEST;
      saveSortMode(sortMode);
      applyGalleryFilter();
    });
  }

  if (createFolderBtn) {
    createFolderBtn.addEventListener('click', openFolderModal);
  }

  if (folderModalCancel) {
    folderModalCancel.addEventListener('click', closeFolderModal);
  }

  if (decoySettingsBtn) {
    decoySettingsBtn.addEventListener('click', openDecoySettingsModal);
  }

  if (decoySettingsCancel) {
    decoySettingsCancel.addEventListener('click', closeDecoySettingsModal);
  }

  if (exportBackupBtn) {
    exportBackupBtn.addEventListener('click', handleExportBackup);
  }

  if (importBackupInput) {
    importBackupInput.addEventListener('change', () => {
      const file = importBackupInput.files?.[0];
      if (file) handleImportBackupFile(file);
    });
  }
}

bindAuthEvents();
bindEvents();

if (decoySettingsForm) {
  decoySettingsForm.addEventListener('submit', handleDecoySettingsSubmit);
}

if (folderForm) {
  folderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = folderNameInput?.value ?? '';
    try {
      setStatus('フォルダを作成中...');
      const isDecoy = folderDecoyCheckbox?.checked ?? false;
      await createFolder(name, { isDecoy });
      closeFolderModal();
      renderFolderList();
      if (isMoveMode && moveTargetSelect) {
        populateFolderSelect(moveTargetSelect, moveTargetSelect.value);
      }
      setStatus('フォルダを作成しました');
    } catch (err) {
      console.error(err);
      setStatus('フォルダの作成に失敗しました');
    }
  });
}

textForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = textTitleInput.value.trim();
  const body = textBodyInput.value;

  if (!title) {
    textTitleInput.focus();
    return;
  }

  try {
    setStatus('保存中...');
    await saveText(title, body);
    closeTextModal();
    await renderGallery();
    setStatus('テキストを保存しました');
  } catch (err) {
    console.error(err);
    setStatus('保存に失敗しました');
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;

  if (!lightboxEl.hidden) {
    if (lightboxDetailController?.isEditing()) {
      lightboxDetailController.cancelEdit();
      return;
    }
    closeLightbox();
    return;
  }
  if (!textViewModal.hidden) {
    if (textViewDetailController?.isEditing()) {
      textViewDetailController.cancelEdit();
      return;
    }
    closeTextView();
    return;
  }
  if (!textModal.hidden) {
    closeTextModal();
    return;
  }
  if (!folderModal.hidden) {
    closeFolderModal();
    return;
  }
  if (!decoySettingsModal.hidden) {
    closeDecoySettingsModal();
    return;
  }
  if (isDeleteMode) {
    exitDeleteMode();
    return;
  }
  if (isMoveMode) {
    exitMoveMode();
    return;
  }
});

enterDeleteModeBtn.addEventListener('click', enterDeleteMode);
enterMoveModeBtn.addEventListener('click', enterMoveMode);
cancelDeleteModeBtn.addEventListener('click', exitDeleteMode);
cancelMoveModeBtn.addEventListener('click', exitMoveMode);
deleteSelectedBtn.addEventListener('click', handleDeleteSelected);
moveSelectedBtn.addEventListener('click', handleMoveSelected);

fileInput.addEventListener('change', async () => {
  const files = [...fileInput.files];
  fileInput.value = '';
  if (files.length === 0) return;

  try {
    setStatus('保存中...');
    const count = await saveFiles(files);
    await renderGallery();
    setStatus(`${count} 件の画像を保存しました`);
  } catch (err) {
    console.error(err);
    setStatus('保存に失敗しました');
  }
});

initApp().catch((err) => {
  console.error(err);
  showLoginError('読み込みに失敗しました');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('Service Worker の登録に失敗しました:', err);
    });
  });
}

window.MyGallery = {
  getEntriesByTag,
  normalizeTagsList,
  filterEntries,
  entryMatchesSearch,
  updateEntry,
  toggleFavorite,
  countFavorites,
  sortEntries,
  SORT_MODE,
  loadSortMode,
  saveSortMode,
  createFolder,
  deleteFolderById,
  selectFolder,
  getFolderName,
  normalizeFolderId,
  moveEntriesToFolder,
  enterMoveMode,
  exitMoveMode,
  exportBackup,
  restoreBackup,
  buildBackupPayload,
  verifyPassword,
  isPasswordConfigured,
  isDecoyPasswordConfigured,
  isDecoySession,
  AUTH_SESSION,
};
