import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	ResourceMapperValue,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { rowFields, rowOperations } from './descriptions/RowDescription';
import {
	combineWhereClauses,
	dataGolAddRow,
	dataGolQueryAllRows,
	dataGolUpdateRow,
	getAllColumns,
	getColumnsForMapping,
	searchTables,
	searchWorkspaces,
} from './GenericFunctions';

export class DataGol implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'DataGOL',
		name: 'dataGol',
		icon: { light: 'file:datagol.svg', dark: 'file:datagol.dark.svg' },
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Add, update, and query rows in a DataGOL table',
		defaults: {
			name: 'DataGOL',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'dataGolApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [{ name: 'Row', value: 'row' }],
				default: 'row',
			},
			...rowOperations,
			...rowFields,
		],
	};

	methods = {
		listSearch: {
			searchWorkspaces,
			searchTables,
		},
		loadOptions: {
			getAllColumns,
		},
		resourceMapping: {
			getColumnsForMapping,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				const workspaceId = this.getNodeParameter('workspaceId', i, undefined, {
					extractValue: true,
				}) as string;
				const tableId = this.getNodeParameter('tableId', i, undefined, {
					extractValue: true,
				}) as string;

				if (operation === 'add' || operation === 'update') {
					const mapped = this.getNodeParameter('columns', i) as ResourceMapperValue;
					const additionalJson = this.getNodeParameter('additionalCellValuesJson', i, '') as string;

					let cellValues: IDataObject = { ...(mapped.value ?? {}) };
					if (additionalJson.trim() !== '') {
						let parsedAdditional: IDataObject;
						try {
							parsedAdditional = JSON.parse(additionalJson) as IDataObject;
						} catch {
							throw new NodeOperationError(
								this.getNode(),
								'Additional Cell Values (JSON) is not valid JSON',
								{ itemIndex: i },
							);
						}
						cellValues = { ...cellValues, ...parsedAdditional };
					}

					let responseData: IDataObject;
					if (operation === 'add') {
						responseData = await dataGolAddRow.call(this, workspaceId, tableId, cellValues);
					} else {
						const rowId = this.getNodeParameter('rowId', i) as string;
						responseData = await dataGolUpdateRow.call(this, workspaceId, tableId, rowId, cellValues);
					}

					returnData.push({ json: responseData, pairedItem: { item: i } });
				} else if (operation === 'getAll') {
					const whereClause = this.getNodeParameter('whereClause', i, '') as string;
					const sortOptionsParam = this.getNodeParameter('sortOptions', i, {}) as {
						sort?: Array<{ columnName: string; direction: 'ASC' | 'DESC' }>;
					};
					const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
					const limit = this.getNodeParameter('limit', i, 100) as number;
					const options = this.getNodeParameter('options', i, {}) as { pageSize?: number };
					const pageSize = options.pageSize ?? 200;

					const bodyTemplate: IDataObject = {};
					const combinedWhere = combineWhereClauses(whereClause);
					if (combinedWhere) {
						bodyTemplate.whereClause = combinedWhere;
					}
					if (sortOptionsParam.sort && sortOptionsParam.sort.length > 0) {
						bodyTemplate.sortOptions = sortOptionsParam.sort.map((sort) => ({
							columnName: sort.columnName,
							direction: sort.direction,
						}));
					}

					const rows = await dataGolQueryAllRows.call(
						this,
						workspaceId,
						tableId,
						bodyTemplate,
						pageSize,
						returnAll ? undefined : limit,
					);

					for (const row of rows) {
						returnData.push({ json: row, pairedItem: { item: i } });
					}
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
