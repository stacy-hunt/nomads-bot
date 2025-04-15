const { Client } = require('@notionhq/client');
require('dotenv').config();

function formatUUID(uuid) {
	return `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;
}

function getClient(clientName = 'nomads') {
	const tokens = {
		nomads: process.env.NOMADS_TOKEN,
		mondplan: process.env.MONDPLAN_TOKEN,
	};

	const token = tokens[clientName];
	if (!token) {
		throw new Error(`❌ Unknown client '${clientName}' or missing token in .env`);
	}

	return new Client({ auth: token });
}

async function dumpBlocks(notion, pageId) {
	const blocks = [];
	let cursor;

	do {
		const response = await notion.blocks.children.list({
			block_id: pageId,
			start_cursor: cursor,
		});
		blocks.push(...response.results);
		cursor = response.has_more ? response.next_cursor : undefined;
	} while (cursor);

	if (blocks.length === 0) {
		console.log('⚠️ No blocks found on this page.');
	}

	for (const block of blocks) {
		console.log({
			id: block.id,
			type: block.type,
			text:
				block[block.type]?.rich_text?.map(rt => rt.plain_text).join('') || '[No text]',
		});
	}
}

// -------------------------
// Manual test (edit freely)
// -------------------------

const notion = getClient('mondplan'); // or 'nomads'
const pageId = formatUUID('1c35fe45647b8113a6d2d793a797e456');

// Ginvigal recession source page '1b198a8f584e80249701d6036c4f171f'
// Gingical recession target page: "1c35fe45647b8113a6d2d793a797e456"

dumpBlocks(notion, pageId).catch(console.error);

// -------------------------

module.exports = { dumpBlocks, getClient, formatUUID };
