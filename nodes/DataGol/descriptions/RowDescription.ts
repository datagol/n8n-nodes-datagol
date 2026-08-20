import type { INodeProperties } from 'n8n-workflow';

import { tableIdField, workspaceIdField } from './SharedFields';

export const rowOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['row'],
			},
		},
		options: [
			{ name: 'Add', value: 'add', description: 'Add a row to a table', action: 'Add a row' },
			{
				name: 'Update',
				value: 'update',
				description: 'Update a row in a table',
				action: 'Update a row',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Query rows from a table',
				action: 'Get many rows',
			},
		],
		default: 'add',
	},
];

const cellValuesField: INodeProperties = {
	displayName: 'Cell Values',
	name: 'columns',
	type: 'resourceMapper',
	noDataExpression: true,
	default: {
		mappingMode: 'defineBelow',
		value: null,
	},
	required: true,
	typeOptions: {
		loadOptionsDependsOn: ['tableId.value'],
		resourceMapper: {
			resourceMapperMethod: 'getColumnsForMapping',
			mode: 'add',
			fieldWords: {
				singular: 'column',
				plural: 'columns',
			},
			addAllFields: false,
		},
	},
};

const additionalCellValuesJsonField: INodeProperties = {
	displayName: 'Additional Cell Values (JSON)',
	name: 'additionalCellValuesJson',
	type: 'json',
	default: '',
	description:
		'Optional raw JSON object merged on top of the Cell Values above (its keys win). Useful for columns the mapper does not expose, e.g. Link columns.',
};

export const rowFields: INodeProperties[] = [
	{
		...workspaceIdField,
		displayOptions: { show: { resource: ['row'] } },
	},
	{
		...tableIdField,
		displayOptions: { show: { resource: ['row'] } },
	},

	// Add
	{
		...cellValuesField,
		displayOptions: { show: { resource: ['row'], operation: ['add'] } },
	},
	{
		...additionalCellValuesJsonField,
		displayOptions: { show: { resource: ['row'], operation: ['add'] } },
	},

	// Update
	{
		displayName: 'Row ID',
		name: 'rowId',
		type: 'string',
		default: '',
		required: true,
		description: 'The ID of the row to update',
		displayOptions: { show: { resource: ['row'], operation: ['update'] } },
	},
	{
		...cellValuesField,
		displayOptions: { show: { resource: ['row'], operation: ['update'] } },
	},
	{
		...additionalCellValuesJsonField,
		displayOptions: { show: { resource: ['row'], operation: ['update'] } },
	},

	// Get Many
	{
		displayName: 'Where Clause',
		name: 'whereClause',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		placeholder: "(`first_name` like '%d%' and `years_of_experience` > 4 and `is_active` = true)",
		description: 'Raw SQL-like WHERE expression. Column names are backtick-quoted.',
		displayOptions: { show: { resource: ['row'], operation: ['getAll'] } },
	},
	{
		displayName: 'Sort',
		name: 'sortOptions',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		placeholder: 'Add Sort',
		default: {},
		displayOptions: { show: { resource: ['row'], operation: ['getAll'] } },
		options: [
			{
				displayName: 'Sort',
				name: 'sort',
				values: [
					{
						displayName: 'Column Name or ID',
						name: 'columnName',
						type: 'options',
						description:
							'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
						typeOptions: { loadOptionsMethod: 'getAllColumns' },
						default: '',
					},
					{
						displayName: 'Direction',
						name: 'direction',
						type: 'options',
						options: [
							{ name: 'Ascending', value: 'ASC' },
							{ name: 'Descending', value: 'DESC' },
						],
						default: 'ASC',
					},
				],
			},
		],
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show: { resource: ['row'], operation: ['getAll'] } },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: {
			show: { resource: ['row'], operation: ['getAll'], returnAll: [false] },
		},
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['row'], operation: ['getAll'] } },
		options: [
			{
				displayName: 'Page Size',
				name: 'pageSize',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 1000 },
				default: 200,
				description: 'Number of rows requested per page while paginating internally',
			},
		],
	},
];
