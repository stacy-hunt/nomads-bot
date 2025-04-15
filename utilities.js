// utilities.js
const fs = require('fs').promises;
const path = './syncTimes.json';

async function readSyncTimes() {
	try {
		const data = await fs.readFile(path, 'utf-8');
		return JSON.parse(data);
	} catch {
		return {};
	}
}

async function writeSyncTimes(syncTimes) {
	await fs.writeFile(path, JSON.stringify(syncTimes, null, 2));
}

module.exports = {
	readSyncTimes,
	writeSyncTimes
};
