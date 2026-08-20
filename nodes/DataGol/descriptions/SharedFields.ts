import type { INodeProperties } from 'n8n-workflow';

export const workspaceIdField: INodeProperties = {
	displayName: 'Workspace',
	name: 'workspaceId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description: 'The DataGOL workspace that contains the table',
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: {
				searchListMethod: 'searchWorkspaces',
				searchable: true,
			},
		},
		{
			displayName: 'ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. 3ded188d-9d9c-4426-89cf-87d87bd8548d',
		},
	],
};

export const tableIdField: INodeProperties = {
	displayName: 'Table',
	name: 'tableId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description: 'The DataGOL table to operate on',
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: {
				searchListMethod: 'searchTables',
				searchable: true,
			},
		},
		{
			displayName: 'ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. cb290390-5f57-4937-81dd-290be2ad81da',
		},
	],
};
