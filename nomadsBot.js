const { syncPages } = require('./syncPages');
const { syncProperties } = require('./syncProperties');
const { syncContent } = require('./syncContent');
const context = require('./config'); // ✅ correctly imports config

async function runBot() {
	try {
		const pagePairs = await syncPages(context);

		for (const { sourcePageId, targetPageId } of pagePairs) {
			console.log(`\n🔁 Syncing:\nSource: ${sourcePageId}\nTarget: ${targetPageId}`);
		
			const sourcePage = await context.notionNomads.pages.retrieve({ page_id: sourcePageId });
			const targetPage = await context.notionClient.pages.retrieve({ page_id: targetPageId });
		
			await syncProperties(sourcePage, targetPage, context);

			console.log(`🧪 Attempting content sync: ${sourcePageId} → ${targetPageId}`);
			await syncContent(sourcePageId, targetPageId, {
				sourceClient: context.notionNomads,
				targetClient: context.notionClient,
			});
			


		
			console.log(`✅ Finished syncing ${targetPageId}`);
		}
		

		console.log('\n🎉 All pages synced!');
	} catch (error) {
		console.error('❌ Error running Nomads Bot:', error);
	}
}

runBot();
