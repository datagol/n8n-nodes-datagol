import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class DataGolApi implements ICredentialType {
	name = 'dataGolApi';

	displayName = 'DataGOL API';

	documentationUrl = 'https://datagol.ai';

	icon: ICredentialType['icon'] = {
		light: 'file:../nodes/DataGol/datagol.svg',
		dark: 'file:../nodes/DataGol/datagol.dark.svg',
	};

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://be.datagol.ai',
			description: 'Base URL of the DataGOL API',
		},
		{
			displayName: 'API Token',
			name: 'apiToken',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description: 'Sent as the "x-auth-token" header on every request',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'x-auth-token': '={{$credentials.apiToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/noCo/api/v2/workspaces',
			method: 'GET',
		},
	};
}
