import type {
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IPollFunctions,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { triggerFields } from './descriptions/TriggerDescription';
import {
	combineWhereClauses,
	dataGolGetTable,
	dataGolQueryAllRows,
	getDateColumns,
	searchTables,
	searchWorkspaces,
} from './GenericFunctions';

interface DataGolTriggerStaticData extends IDataObject {
	lastDateValue?: string | null;
	lastIds?: Array<string | number>;
}

/** Row cell values come back nested under `cellValues`; `id` is the only top-level field. */
function getCellValue(row: IDataObject, columnName: string): unknown {
	return (row.cellValues as IDataObject | undefined)?.[columnName];
}

function buildQueryBody(
	whereClause: string,
	sortOptions: Array<{ columnName: string; direction: 'ASC' | 'DESC' }>,
): IDataObject {
	const body: IDataObject = { sortOptions };
	if (whereClause) {
		body.whereClause = whereClause;
	}
	return body;
}

// n8n's community-node verifier forbids `usableAsTool` on trigger nodes
// (triggers can't be invoked as AI tools); the type only allows `true`, so
// omitting the property is the only valid way to comply, which trips this
// (trigger-unaware) rule.
// eslint-disable-next-line @n8n/community-nodes/node-usable-as-tool
export class DataGolTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'DataGOL Trigger',
		name: 'dataGolTrigger',
		icon: { light: 'file:datagol.svg', dark: 'file:datagol.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["watchFor"]}}',
		description: 'Starts the workflow when a row is added or updated in a DataGOL workbook',
		defaults: {
			name: 'DataGOL Trigger',
		},
		polling: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'dataGolApi',
				required: true,
			},
		],
		properties: triggerFields,
	};

	methods = {
		listSearch: {
			searchWorkspaces,
			searchTables,
		},
		loadOptions: {
			getDateColumns,
		},
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const workspaceId = this.getNodeParameter('workspaceId', undefined, {
			extractValue: true,
		}) as string;
		const tableId = this.getNodeParameter('tableId', undefined, {
			extractValue: true,
		}) as string;
		const dateColumn = this.getNodeParameter('dateColumn') as string;
		const firstPollBehavior = this.getNodeParameter('firstPollBehavior', 'emitNothing') as string;
		const backfillCount = this.getNodeParameter('backfillCount', 10) as number;
		const additionalFilter = this.getNodeParameter('additionalFilter', '') as string;
		const pageSize = this.getNodeParameter('pageSize', 200) as number;

		if (!dateColumn) {
			throw new NodeOperationError(this.getNode(), 'Date Column is required');
		}

		const additionalFilterClause = combineWhereClauses(additionalFilter);

		// Manual test-run: always show the single most recent row, and never
		// touch the polling state used by scheduled runs.
		if (this.getMode() === 'manual') {
			const rows = await dataGolQueryAllRows.call(
				this,
				workspaceId,
				tableId,
				buildQueryBody(additionalFilterClause, [{ columnName: dateColumn, direction: 'DESC' }]),
				pageSize,
				1,
			);
			return rows.length > 0 ? [rows.map((row) => ({ json: row }))] : null;
		}

		const staticData = this.getWorkflowStaticData('node') as DataGolTriggerStaticData;
		const isFirstPollEver = staticData.lastDateValue === undefined;

		if (isFirstPollEver && firstPollBehavior === 'emitNothing') {
			const seedRows = await dataGolQueryAllRows.call(
				this,
				workspaceId,
				tableId,
				buildQueryBody(additionalFilterClause, [{ columnName: dateColumn, direction: 'DESC' }]),
				pageSize,
				1,
			);
			const seedRow = seedRows[0];
			staticData.lastDateValue = seedRow ? ((getCellValue(seedRow, dateColumn) as string) ?? null) : null;
			staticData.lastIds = seedRow ? [seedRow.id as string | number] : [];
			return null;
		}

		if (isFirstPollEver) {
			// backfillLastN: fetch from the start of the table (no dedup floor
			// yet), then slice to the last N further down.
			staticData.lastDateValue = null;
			staticData.lastIds = [];
		}

		const isPendingBackfill =
			staticData.lastDateValue === null && (staticData.lastIds ?? []).length === 0;

		const dedupFragment =
			staticData.lastDateValue != null ? `\`${dateColumn}\` >= '${staticData.lastDateValue}'` : undefined;
		const whereClause = combineWhereClauses(dedupFragment, additionalFilterClause);

		const table = await dataGolGetTable.call(this, workspaceId, tableId);
		const tiebreakColumn = table?.primaryKeyColumnName ?? dateColumn;

		const allRows = await dataGolQueryAllRows.call(
			this,
			workspaceId,
			tableId,
			buildQueryBody(whereClause, [
				{ columnName: dateColumn, direction: 'ASC' },
				{ columnName: tiebreakColumn, direction: 'ASC' },
			]),
			pageSize,
		);

		const lastIds = new Set(staticData.lastIds ?? []);
		let newRows = allRows.filter(
			(row) =>
				!(getCellValue(row, dateColumn) === staticData.lastDateValue && lastIds.has(row.id as string | number)),
		);

		if (isPendingBackfill && firstPollBehavior === 'backfillLastN') {
			newRows = newRows.slice(-backfillCount);
		}

		if (newRows.length === 0) {
			return null;
		}

		const maxDate = newRows.reduce<string | null>((max, row) => {
			const value = getCellValue(row, dateColumn) as string | undefined;
			if (value === undefined) return max;
			return max === null || value > max ? value : max;
		}, null);

		staticData.lastDateValue = maxDate;
		staticData.lastIds = newRows
			.filter((row) => getCellValue(row, dateColumn) === maxDate)
			.map((row) => row.id as string | number);

		return [newRows.map((row) => ({ json: row }))];
	}
}
