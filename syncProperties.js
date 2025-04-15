const fs = require('fs');

// Load mapping.json
const propertyMapping = JSON.parse(fs.readFileSync('mapping.json', 'utf8'));

function getPropertyValue(task, propertyName, type) {
	const property = task.properties[propertyName];

	switch (type) {
		case 'title':
			return property?.title?.[0]?.plain_text || '';
		case 'select':
			return property?.select?.name || '';
		case 'multi_select':
			return property?.multi_select?.map(option => option.name).join(', ') || '';
		case 'date':
			return property?.date?.start || '';
		case 'status':
			return property?.status?.name || '';
		default:
			return '';
	}
}

function formatNotionProperty(value, type) {
	switch (type) {
		case 'title':
			return { title: [{ text: { content: value } }] };
		case 'select':
			return { select: { name: value } };
		case 'multi_select':
			return { multi_select: value.split(', ').map(name => ({ name })) };
		case 'date':
			return { date: { start: value } };
		case 'status':
			return { status: { name: value } };
		default:
			return {};
	}
}

async function syncProperties(sourceTask, targetTask, context) {
	const { notionClient } = context;

	const updates = {};

	for (const [key, mapping] of Object.entries(propertyMapping)) {
		let sourceValue = getPropertyValue(sourceTask, mapping.source, mapping.type);
		const targetValue = getPropertyValue(targetTask, mapping.target, mapping.type);

		// Translate using option mappings if provided
		if (mapping.options && sourceValue) {
			if (Array.isArray(sourceValue)) {
				sourceValue = sourceValue.map(opt => mapping.options[opt] || null).filter(Boolean);
			} else {
				sourceValue = mapping.options[sourceValue] || null;
			}
		}

		if (mapping.type === 'status' && !sourceValue) {
			console.log(`⚠️ Skipping status update: Source value is empty.`);
			continue;
		}

		if (sourceValue && sourceValue !== targetValue) {
			console.log(`✏️ Updating ${mapping.target}: "${targetValue}" → "${sourceValue}"`);
			updates[mapping.target] = formatNotionProperty(sourceValue, mapping.type);
		}
	}

	if (Object.keys(updates).length > 0) {
		await notionClient.pages.update({
			page_id: targetTask.id,
			properties: updates
		});
	}
}

module.exports = { syncProperties };
