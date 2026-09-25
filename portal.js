function getPortalApp() {
    return {
        token: localStorage.getItem('gh_token') || '',
        owner: localStorage.getItem('gh_owner') || '',
        isAdmin: localStorage.getItem('is_admin') === 'true',
        status: 'READY',
        db: null,
        counts: { vehicles: 0, parts: 0 },
        revenue: 0,
        workshopName: 'R&K AUTO GARAGE',
        currencySymbol: '£',
        adminCode: '',
        garageList: [],

        async initShared() {
            if (!this.token || !this.owner) {
                const t = prompt('Enter GitHub Token:');
                const o = prompt('Enter GitHub Username:');
                if (t && o) {
                    localStorage.setItem('gh_token', t);
                    localStorage.setItem('gh_owner', o);
                    location.reload();
                }
                return;
            }
            await this.loadSummary();
            await this.loadDatabase();
        },

        async loadSummary() {
            try {
                const resp = await fetch(`https://api.github.com/repos/${this.owner}/RKGarage-Backups/contents/data.json`, {
                    headers: { 'Authorization': 'token ' + this.token, 'Accept': 'application/vnd.github.v3.raw' }
                });
                const data = await resp.json();
                this.counts.vehicles = data.vehiclesCount;
                this.counts.parts = data.partsCount;
                this.revenue = data.revenue;
                this.workshopName = data.workshopName || 'R&K AUTO GARAGE';
                this.currencySymbol = data.currencySymbol || '£';
                this.adminCode = data.adminCode || '';
            } catch (e) {
                console.error("Summary load failed", e);
            }
        },

        async loadDatabase() {
            this.status = 'SYNCING...';
            try {
                const resp = await fetch(`https://api.github.com/repos/${this.owner}/RKGarage-Backups/contents/backups/garage_database.db`, {
                    headers: { 'Authorization': 'token ' + this.token, 'Accept': 'application/vnd.github.v3.raw' }
                });
                const buf = await resp.arrayBuffer();
                const SQL = await initSqlJs({ locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}` });
                this.db = new SQL.Database(new Uint8Array(buf));
                this.status = 'ACTIVE';

                // Common cache for lists
                const vData = this.db.exec("SELECT * FROM vehicles ORDER BY regPlate ASC");
                if (vData.length > 0) {
                    this.garageList = vData[0].values.map(row => {
                        let obj = {}; vData[0].columns.forEach((col, i) => obj[col] = row[i]);
                        return obj;
                    });
                }
            } catch (e) {
                this.status = 'OFFLINE';
                console.error("Database load failed", e);
            }
        },

        promptAdmin() {
            const c = prompt('Enter 7-Digit Admin Code:');
            if (c && c === this.adminCode) {
                this.isAdmin = true;
                localStorage.setItem('is_admin', 'true');
                location.reload();
            } else {
                alert('Access Denied');
            }
        },

        logout() {
            localStorage.clear();
            location.reload();
        },

        async syncCloud() {
            this.status = 'SAVING...';
            const binary = this.db.export();
            let b64 = btoa(String.fromCharCode(...new Uint8Array(binary)));

            const metaResp = await fetch(`https://api.github.com/repos/${this.owner}/RKGarage-Backups/contents/backups/garage_database.db`, {
                headers: { 'Authorization': 'token ' + this.token }
            });
            const meta = await metaResp.json();

            const res = await fetch(`https://api.github.com/repos/${this.owner}/RKGarage-Backups/contents/backups/garage_database.db`, {
                method: 'PUT',
                headers: { 'Authorization': 'token ' + this.token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'Web Portal Edit', content: b64, sha: meta.sha })
            });

            if (res.ok) {
                this.status = 'ACTIVE';
                return true;
            }
            return false;
        }
    };
}
