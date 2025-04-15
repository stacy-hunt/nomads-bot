async function getAllBlocks(notion, blockId) {
	const blocks = [];
	let cursor;

	do {
		const response = await notion.blocks.children.list({
			block_id: blockId,
			start_cursor: cursor,
		});
		blocks.push(...response.results);
		cursor = response.has_more ? response.next_cursor : null;
	} while (cursor);

	for (const block of blocks) {
		if (block.has_children) {
			block.children = await getAllBlocks(notion, block.id);
		}
	}

	return blocks;
}

function findSyncBreakpointIndex(blocks) {
	return blocks.findIndex((block) => {
		if (block.type === 'callout') {
			const text = block.callout.rich_text
				.map((rt) => rt.plain_text?.toLowerCase())
				.join('');
			return text.includes('sync breakpoint');
		}
		return false;
	});
}

function filterBlocksBeforeBreakpoint(blocks) {
	const index = findSyncBreakpointIndex(blocks);
	return index === -1 ? blocks : blocks.slice(0, index);
}

function cleanBlocksForAppend(blocks) {
	return blocks.map((block) => {
		const cleaned = {
			type: block.type,
			has_children: block.has_children,
			[block.type]: { ...block[block.type] },
		};

		if (block.type === "image") {
			const original = cleaned.image;

			if (original.type === "external") {
				delete cleaned.image.file;
			} else if (original.type === "file") {
				cleaned.image = {
					caption: original.caption || [],
					type: "external",
					external: {
						url: original.file?.url || ""
					}
				};
			}
		}

		if (block.children || block._children) {
			cleaned._children = cleanBlocksForAppend(block.children || block._children);
		}

		return cleaned;
	});
}

async function appendBlocks(notion, targetBlockId, blocks) {
	let lastBlockId = null;

	for (const block of blocks) {
		const { _children, ...blockWithoutChildren } = block;

		try {
			const response = await notion.blocks.children.append({
				block_id: targetBlockId,
				children: [blockWithoutChildren],
				...(lastBlockId && { after: lastBlockId })
			});

			const newBlockId = response.results[0]?.id;
			lastBlockId = newBlockId;

			if (_children && newBlockId) {
				await appendBlocks(notion, newBlockId, _children);
			}
		} catch (error) {
			console.error(`❌ Failed to append block:`, JSON.stringify(blockWithoutChildren, null, 2));
			throw error;
		}
	}
}

async function syncContent(sourcePageId, targetPageId, { sourceClient, targetClient }) {
	const sourceBlocks = await getAllBlocks(sourceClient, sourcePageId);
	const rawBlocks = filterBlocksBeforeBreakpoint(sourceBlocks);
	const blocksToCopy = cleanBlocksForAppend(rawBlocks);

	const targetBlocks = await getAllBlocks(targetClient, targetPageId);
	const breakpointIndex = findSyncBreakpointIndex(targetBlocks);

	let blocksAfterBreakpoint = [];
	if (breakpointIndex !== -1) {
		blocksAfterBreakpoint = targetBlocks.slice(breakpointIndex);
	}

	// Delete everything first
	for (const block of targetBlocks) {
		await targetClient.blocks.delete({ block_id: block.id });
	}

	// Reinsert the new blocks
	await appendBlocks(targetClient, targetPageId, blocksToCopy);

	// Reinsert the preserved tail
	await appendBlocks(targetClient, targetPageId, cleanBlocksForAppend(blocksAfterBreakpoint));

	console.log(`📦 Total blocks on source page: ${sourceBlocks.length}`);
	console.log(`✂️ Blocks to copy (before breakpoint): ${blocksToCopy.length}`);
}

module.exports = { syncContent };
