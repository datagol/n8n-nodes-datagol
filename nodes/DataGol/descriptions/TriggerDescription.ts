import type { INodeProperties } from 'n8n-workflow';

import { tableIdField, workspaceIdField } from './SharedFields';

export const triggerFields: INodeProperties[] = [
	workspaceIdField,
	tableIdField,
	{
		displayName: 'Watch For',
		name: 'watchFor',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Row Added', value: 'added', description: 'Trigger when a new row is added' },
			{ name: 'Row Updated', value: 'updated', description: 'Trigger when an existing row is updated' },
		],
		default: 'added',
	},
	{
		displayName: 'Date Column Name or ID',
		name: 'dateColumn',
		type: 'options',
		typeOptions: {
			loadOptionsDependsOn: ['workspaceId.value', 'tableId.value'],
			loadOptionsMethod: 'getDateColumns',
		},
		default: '',
		required: true,
		description:
			'Column used to detect new/changed rows. Works best with a Date column such as a created_at/updated_at audit column (listed first, marked Recommended), but any column in the workbook can be chosen. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'First Poll Behavior',
		name: 'firstPollBehavior',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'Emit Nothing on Activation',
				value: 'emitNothing',
				description: 'Do not emit anything on the first poll after activation; only rows added/updated afterwards',
			},
			{
				name: 'Backfill Last N Rows',
				value: 'backfillLastN',
				description: 'On the first poll, also emit up to N of the most recent existing rows',
			},
		],
		default: 'emitNothing',
	},
	{
		displayName: 'Backfill Count',
		name: 'backfillCount',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 10,
		displayOptions: {
			show: { firstPollBehavior: ['backfillLastN'] },
		},
	},
	{
		displayName: 'Additional Filter',
		name: 'additionalFilter',
		type: 'string',
		typeOptions: { rows: 2 },
		default: '',
		placeholder: "`status` = 'Open'",
		description: 'Optional extra raw WHERE-clause fragment, ANDed with the internal change-detection filter',
	},
	{
		displayName: 'Page Size',
		name: 'pageSize',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 1000 },
		default: 200,
		description: 'Page size used while paginating through new/changed rows on each poll',
	},
];
