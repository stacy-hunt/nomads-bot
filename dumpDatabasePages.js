// dumpFullPages.js
require('dotenv').config();
const { Client } = require('@notionhq/client');

const notionNomads = new Client({ auth: process.env.NOMADS_TOKEN });
const notionClient = new Client({ auth: process.env.MONDPLAN_TOKEN });

const SOURCE_DB_ID = 'your_source_db_id_here';
const TARGET_DB_ID = 'your_target_db_id_here';

async function dumpPagesWithProperties(notion, dbId, label) {
	console.log(`\n📋 Full page dump from ${label}:`);
	let cursor;

	do {
		const response = await notion.databases.query({
			database_id: dbId,
			start_cursor: cursor,
		});

		for (const page of response.results) {
			const title = page.properties?.Name?.title?.[0]?.plain_text || '[No title]';
			const isArchived = page.archived ? '🗑️ Archived' : '✅ Active';

			console.log(`\n🔹 ${title} (${page.id}) ${isArchived}`);
			for (const [propName, propData] of Object.entries(page.properties)) {
				const type = propData.type;
				let value = '[unknown]';

				switch (type) {
					case 'title':
						value = propData.title?.map(t => t.plain_text).join('') || '';
						break;
					case 'rich_text':
						value = propData.rich_text?.map(t => t.plain_text).join('') || '';
						break;
					case 'checkbox':
						value = propData.checkbox;
						break;
					case 'select':
						value = propData.select?.name || '';
						break;
					case 'multi_select':
						value = propData.multi_select?.map(opt => opt.name).join(', ') || '';
						break;
					case 'status':
						value = propData.status?.name || '';
						break;
					case 'date':
						value = propData.date?.start || '';
						break;
					default:
						value = '[unsupported type]';
				}

				console.log(`   🧷 ${propName} (${type}): ${value}`);
			}
		}

		cursor = response.has_more ? response.next_cursor : null;
	} while (cursor);
}

async function run() {
	await dumpPagesWithProperties(notionNomads, '1b198a8f-584e-80b6-9e01-e5d2ca4ac0a8', 'SOURCE DB');
	await dumpPagesWithProperties(notionClient, '1b15fe45-647b-80a4-99ec-e15d60953a2e', 'TARGET DB');
}

run().catch(console.error);
