// Configuration for RKGarage-Backups Repository
const REPO_OWNER = 'michaelfordejr2';
const REPO_NAME = 'RKGarage-Backups';
const DB_FILE_PATH = 'garage_database.db';
const CHECK_INTERVAL_MS = 30000; // Poll every 30 seconds

let SQLModule = null;
let dbInstance = null;
let currentCommitSha = null;

// Initialize sql.js WebAssembly Engine
async function initEngine() {
  try {
    updateStatus('Loading WebAssembly SQLite...', false);
    SQLModule = await initSqlJs({
      locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
    });
    
    // Initial fetch of the database
    await fetchAndLoadDatabase();
    
    // Start listening for new commits on GitHub
    startAutoUpdateListener();
  } catch (err) {
    console.error('Failed to initialize database engine:', err);
    updateStatus('Failed to load SQL engine', false);
  }
}

// Fetch the database file binary and load it into SQLite
async function fetchAndLoadDatabase(isManual = false) {
  try {
    if (isManual) updateStatus('Busting cache & fetching DB...', false);

    // Cache-busting timestamp query parameter
    const cacheBuster = `?t=${Date.now()}`;
    const response = await fetch(`\({DB_FILE_PATH}\){cacheBuster}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    dbInstance = new SQLModule.Database(new Uint8Array(arrayBuffer));

    updateStatus('Connected & Syncing', true);
    populateTableSelector();
  } catch (err) {
    console.error('Error fetching database file:', err);
    updateStatus('Error loading database file', false);
  }
}

// Populate dropdown selector with all user tables inside garage_database.db
function populateTableSelector() {
  if (!dbInstance) return;

  const res = dbInstance.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
  const select = document.getElementById('table-select');
  select.innerHTML = '';

  if (res.length > 0 && res[0].values.length > 0) {
    const tables = res[0].values.flat();
    tables.forEach((tableName, index) => {
      const option = document.createElement('option');
      option.value = tableName;
      option.textContent = tableName;
      select.appendChild(option);
    });

    // Automatically render the first table
    renderTable(tables[0]);
  } else {
    document.getElementById('data-table').innerHTML = '
