let db = null;
let repoOwner = '';
let accessToken = '';

async function initPortal() {
    accessToken = localStorage.getItem('gh_token');
    repoOwner = localStorage.getItem('gh_owner');
    
    if (!accessToken || !repoOwner) {
        const token = prompt('Enter GitHub Access Token:');
        const owner = prompt('Enter GitHub Username:');
        if (token && owner) {
            localStorage.setItem('gh_token', token);
            localStorage.setItem('gh_owner', owner);
            accessToken = token;
            repoOwner = owner;
        } else {
            document.getElementById('status').innerText = 'Auth Required to load Database.';
            return;
        }
    }
    loadDatabase();
}

async function loadDatabase() {
    try {
        const response = await fetch(`https://api.github.com/repos/` + repoOwner + `/RKGarage-Backups/contents/backups/garage_database.db`, {
            headers: { 'Authorization': 'Bearer ' + accessToken, 'Accept': 'application/vnd.github.v3.raw' }
        });
        const buffer = await response.arrayBuffer();
        const SQL = await initSqlJs({ locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/` + file });
        db = new SQL.Database(new Uint8Array(buffer));
        document.getElementById('status').innerText = 'Database Synced.';
        if (window.renderPageData) renderPageData();
    } catch (e) {
        console.error(e);
        document.getElementById('status').innerText = 'Error loading Database.';
    }
}

async function saveDatabase() {
    document.getElementById('status').innerText = 'Saving to Cloud...';
    const binary = db.export();
    const base64 = btoa(String.fromCharCode.apply(null, binary));
    
    // Get current file SHA
    const getResp = await fetch(`https://api.github.com/repos/` + repoOwner + `/RKGarage-Backups/contents/backups/garage_database.db`, {
        headers: { 'Authorization': 'Bearer ' + accessToken }
    });
    const meta = await getResp.json();

    const pushResp = await fetch(`https://api.github.com/repos/` + repoOwner + `/RKGarage-Backups/contents/backups/garage_database.db`, {
        method: 'PUT',
        headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: 'Cloud Update from Web Portal',
            content: base64,
            sha: meta.sha
        })
    });
    
    if (pushResp.ok) {
        document.getElementById('status').innerText = 'Changes saved to Cloud.';
    } else {
        document.getElementById('status').innerText = 'Sync failed.';
    }
}

window.onload = initPortal;