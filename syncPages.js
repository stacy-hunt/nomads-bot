const { syncProperties } = require('./syncProperties');
const { readSyncTimes, writeSyncTimes } = require('./utilities');

async function getDatabaseTasks(notionClient, databaseId) {
	const pages = [];
	let cursor = undefined;

	do {
		const response = await notionClient.databases.query({
			database_id: databaseId,
			start_cursor: cursor,
		});

		pages.push(...response.results);
		cursor = response.has_more ? response.next_cursor : undefined;
	} while (cursor);

	return pages;
}

async function syncPages(context) {
	const {
		notionNomads,
		notionClient,
		sourceDbId,
		targetDbId
	} = context;

	console.log('🔄 Starting page sync...');

	const sourceTasks = await getDatabaseTasks(notionNomads, sourceDbId);
	const targetTasks = await getDatabaseTasks(notionClient, targetDbId);

	const syncTimes = await readSyncTimes();
	const syncedPagePairs = [];

	for (const sourceTask of sourceTasks) {
		const sourceName = sourceTask.properties.Name?.title?.[0]?.plain_text || '[No Name]';
		const syncEnabled = sourceTask.properties['Sync']?.checkbox || false;
		let syncID = (() => {
			const rt = sourceTask.properties['Sync ID']?.rich_text;
			if (!rt || rt.length === 0) return '';
			const content = rt[0].text?.content || '';
			return content.trim();
		})();

		const orphanedSyncID = syncID && !targetTasks.some(task => task.id === syncID);
		if (orphanedSyncID) {
			console.log(`🧹 Orphaned Sync ID found for "${sourceName}". Clearing it...`);
			await notionNomads.pages.update({
				page_id: sourceTask.id,
				properties: {
					'Sync ID': { rich_text: [{ text: { content: '' } }] }
				}
			});
			syncID = '';
		}

		console.log(`🔍 Processing: "${sourceName}"`);

		if (!syncEnabled) {
			console.log(`⏸️ Sync is OFF for "${sourceName}".`);
			if (syncID) {
				const targetTask = targetTasks.find(task => task.id === syncID);
				if (targetTask) {
					console.log(`🗑️ Deleting target task for "${sourceName}"...`);
					await notionClient.pages.update({
						page_id: targetTask.id,
						archived: true
					});
				}
				await notionNomads.pages.update({
					page_id: sourceTask.id,
					properties: {
						'Sync ID': { rich_text: [{ text: { content: '' } }] }
					}
				});
				console.log(`🧼 Sync ID cleared in source task.`);
			} else {
				console.log(`🟡 Sync is off, but no Sync ID to clear.`);
			}
			continue;
		}

		const lastSynced = syncTimes[sourceTask.id];
		const lastEdited = new Date(sourceTask.last_edited_time).getTime();
		if (lastSynced && lastEdited <= lastSynced) {
			console.log(`🟣 No changes detected for "${sourceName}". Skipping.`);
			continue;
		}

		let targetTask = syncID && targetTasks.find(task => task.id === syncID);

		if (!syncID) {
			console.log(`➕ Creating task in target for "${sourceName}"...`);
			const newPage = await notionClient.pages.create({
				parent: { database_id: targetDbId },
				properties: {
					Name: { title: [{ text: { content: sourceName } }] }
				}
			});
			syncID = newPage.id;
			targetTask = newPage;
			await notionNomads.pages.update({
				page_id: sourceTask.id,
				properties: {
					'Sync ID': { rich_text: [{ text: { content: syncID } }] }
				}
			});
			console.log(`📌 Sync ID stored in source task.`);
		} else {
			console.log(`✅ Already synced (Sync ID exists)`);
		}

		if (targetTask) {
			await syncProperties(sourceTask, targetTask, context);

			syncedPagePairs.push({
				sourcePageId: sourceTask.id,
				targetPageId: targetTask.id,
			});

			syncTimes[sourceTask.id] = Date.now();
		}
	}

	await writeSyncTimes(syncTimes);
	console.log('✅ Page sync complete!');
	return syncedPagePairs;
}

module.exports = { syncPages };