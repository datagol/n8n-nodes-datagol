import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INodeListSearchItems,
	INodeListSearchResult,
	INodePropertyOptions,
	IPollFunctions,
	JsonObject,
	ResourceMapperField,
	ResourceMapperFields,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

export type DataGolContext = IExecuteFunctions | ILoadOptionsFunctions | IPollFunctions;

export interface DataGolColumn extends IDataObject {
	id: string;
	name: string;
	uiDataType: string;
	isDataEditable: boolean;
	isAudit: boolean;
	uiMetadata?: { title?: string };
}

export interface DataGolTable extends IDataObject {
	id: string;
	title: string;
	tableName: string;
	tableType: string;
	primaryKeyColumnName: string;
	columns: DataGolColumn[];
}

/**
 * Low-level authenticated request against the DataGOL API. `endpoint` is
 * relative to `/noCo/api/v2` (e.g. `/workspaces` or
 * `/workspaces/{id}/tables/{id}/rows`).
 */
export async function dataGolApiRequest(
	this: DataGolContext,
	method: IHttpRequestMethods,
	endpoint: string,
	body?: IDataObject,
	qs?: IDataObject,
): Promise<IDataObject | IDataObject[]> {
	const credentials = await this.getCredentials('dataGolApi');
	const baseUrl = ((credentials.baseUrl as string) || 'https://be.datagol.ai').replace(/\/+$/, '');

	const options: IHttpRequestOptions = {
		method,
		url: `${baseUrl}/noCo/api/v2${endpoint}`,
		json: true,
	};

	if (body !== undefined) {
		options.body = body;
	}
	if (qs !== undefined && Object.keys(qs).length > 0) {
		options.qs = qs;
	}

	try {
		return await this.helpers.httpRequestWithAuthentication.call(this, 'dataGolApi', options);
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

export async function dataGolListWorkspaces(this: DataGolContext): Promise<IDataObject[]> {
	const response = await dataGolApiRequest.call(this, 'GET', '/workspaces');
	return Array.isArray(response) ? (response as IDataObject[]) : [];
}

export async function dataGolListTables(
	this: DataGolContext,
	workspaceId: string,
): Promise<DataGolTable[]> {
	const response = await dataGolApiRequest.call(this, 'GET', `/workspaces/${workspaceId}/tables`);
	return Array.isArray(response) ? (response as DataGolTable[]) : [];
}

export async function dataGolGetTable(
	this: DataGolContext,
	workspaceId: string,
	tableId: string,
): Promise<DataGolTable | undefined> {
	// The list endpoint (`/tables`) returns each table with an empty
	// `columns` array; only the single-table endpoint includes full column
	// metadata, which the resourceMapper and date-column picker need.
	const response = await dataGolApiRequest.call(
		this,
		'GET',
		`/workspaces/${workspaceId}/tables/${tableId}`,
	);
	return response as DataGolTable;
}

export async function dataGolQueryRows(
	this: DataGolContext,
	workspaceId: string,
	tableId: string,
	body: IDataObject,
): Promise<IDataObject> {
	const response = await dataGolApiRequest.call(
		this,
		'POST',
		`/workspaces/${workspaceId}/tables/${tableId}/cursor`,
		body,
	);
	return response as IDataObject;
}

export async function dataGolAddRow(
	this: DataGolContext,
	workspaceId: string,
	tableId: string,
	cellValues: IDataObject,
): Promise<IDataObject> {
	const response = await dataGolApiRequest.call(
		this,
		'POST',
		`/workspaces/${workspaceId}/tables/${tableId}/rows`,
		{ cellValues },
	);
	return response as IDataObject;
}

export async function dataGolUpdateRow(
	this: DataGolContext,
	workspaceId: string,
	tableId: string,
	id: string | number,
	cellValues: IDataObject,
): Promise<IDataObject> {
	const response = await dataGolApiRequest.call(
		this,
		'PUT',
		`/workspaces/${workspaceId}/tables/${tableId}/rows`,
		{ id, cellValues },
	);
	return response as IDataObject;
}

interface ParsedCursorResponse {
	rows: IDataObject[];
	isLastPage: boolean;
}

/**
 * The exact response envelope of the cursor/query endpoint was not
 * documented. This defensively tries several plausible key names so the
 * rest of the code never has to touch the raw response. If DataGOL's real
 * shape differs, only this function needs to change.
 */
export function parseCursorResponse(body: IDataObject, requestedPageSize: number): ParsedCursorResponse {
	const rows = (body.rows ?? body.data ?? body.items ?? body.records ?? []) as IDataObject[];
	const totalPages = (body.totalPages ?? body.total_pages) as number | undefined;
	const pageNumber = (body.pageNumber ?? body.page_number ?? 1) as number;

	let isLastPage = (body.isLastPage ?? body.is_last_page) as boolean | undefined;
	if (isLastPage === undefined) {
		isLastPage = totalPages !== undefined ? pageNumber >= totalPages : rows.length < requestedPageSize;
	}

	return { rows, isLastPage };
}

/**
 * Walks the cursor endpoint page by page, accumulating rows until either
 * the last page is reached, `maxItems` is hit (when provided), or a safety
 * cap on page count is reached (protects against an API that never reports
 * `isLastPage`).
 */
export async function dataGolQueryAllRows(
	this: DataGolContext,
	workspaceId: string,
	tableId: string,
	bodyTemplate: IDataObject,
	pageSize: number,
	maxItems?: number,
): Promise<IDataObject[]> {
	const allRows: IDataObject[] = [];
	const maxPagesSafetyCap = 1000;

	for (let pageNumber = 1; pageNumber <= maxPagesSafetyCap; pageNumber++) {
		const body: IDataObject = {
			...bodyTemplate,
			requestPageDetails: { pageNumber, pageSize },
		};
		const response = (await dataGolQueryRows.call(this, workspaceId, tableId, body)) as IDataObject;
		const parsed = parseCursorResponse(response, pageSize);

		allRows.push(...parsed.rows);

		if (maxItems !== undefined && allRows.length >= maxItems) {
			return allRows.slice(0, maxItems);
		}
		if (parsed.isLastPage || parsed.rows.length === 0) {
			break;
		}
	}

	return allRows;
}

/** Joins non-empty WHERE fragments with AND, parenthesizing each one. */
export function combineWhereClauses(...fragments: Array<string | undefined>): string {
	const nonEmpty = fragments.map((fragment) => fragment?.trim()).filter((fragment): fragment is string => !!fragment);
	if (nonEmpty.length === 0) {
		return '';
	}
	return nonEmpty.map((fragment) => `(${fragment})`).join(' and ');
}

function tableDisplayName(table: DataGolTable): string {
	return table.title || table.tableName || table.id;
}

export async function searchWorkspaces(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const workspaces = await dataGolListWorkspaces.call(this);

	const results: INodeListSearchItems[] = workspaces
		.map((workspace) => ({
			name: (workspace.name as string) || (workspace.id as string),
			value: workspace.id as string,
		}))
		.filter((item) => !filter || item.name.toLowerCase().includes(filter.toLowerCase()))
		.sort((a, b) => a.name.localeCompare(b.name));

	return { results };
}

export async function searchTables(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const workspaceId = this.getNodeParameter('workspaceId', undefined, {
		extractValue: true,
	}) as string;
	if (!workspaceId) {
		return { results: [] };
	}

	const tables = await dataGolListTables.call(this, workspaceId);

	const results: INodeListSearchItems[] = tables
		.map((table) => ({ name: tableDisplayName(table), value: table.id }))
		.filter((item) => !filter || item.name.toLowerCase().includes(filter.toLowerCase()))
		.sort((a, b) => a.name.localeCompare(b.name));

	return { results };
}

/** All columns of the selected table, for sort-column / generic column pickers. */
export async function getAllColumns(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const workspaceId = this.getNodeParameter('workspaceId', undefined, {
		extractValue: true,
	}) as string;
	const tableId = this.getNodeParameter('tableId', undefined, {
		extractValue: true,
	}) as string;
	if (!workspaceId || !tableId) {
		return [];
	}

	const table = await dataGolGetTable.call(this, workspaceId, tableId);
	if (!table) {
		return [];
	}

	return table.columns
		.map((column) => ({ name: column.uiMetadata?.title ?? column.name, value: column.name }))
		.sort((a, b) => a.name.localeCompare(b.name));
}

/** DATE-typed columns for the trigger's "Date Column" picker, audit columns first. */
export async function getDateColumns(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const workspaceId = this.getNodeParameter('workspaceId', undefined, {
		extractValue: true,
	}) as string;
	const tableId = this.getNodeParameter('tableId', undefined, {
		extractValue: true,
	}) as string;
	if (!workspaceId || !tableId) {
		return [];
	}

	const table = await dataGolGetTable.call(this, workspaceId, tableId);
	if (!table) {
		return [];
	}

	return table.columns
		.filter((column) => column.uiDataType === 'DATE')
		.map((column) => ({
			name: column.isAudit
				? `${column.uiMetadata?.title ?? column.name} (Recommended)`
				: (column.uiMetadata?.title ?? column.name),
			value: column.name,
		}))
		.sort((a, b) => Number(b.name.includes('Recommended')) - Number(a.name.includes('Recommended')));
}

const UI_DATA_TYPE_TO_FIELD_TYPE: Record<string, ResourceMapperField['type']> = {
	NUMBER: 'number',
	DATE: 'dateTime',
	BOOLEAN: 'boolean',
};

/**
 * Builds the resourceMapper schema for a table's editable, non-link columns
 * so Add/Update Row can offer a real, schema-backed field mapper instead of
 * free-text column entry.
 */
export async function getColumnsForMapping(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
	const workspaceId = this.getNodeParameter('workspaceId', undefined, {
		extractValue: true,
	}) as string;
	const tableId = this.getNodeParameter('tableId', undefined, {
		extractValue: true,
	}) as string;
	if (!workspaceId || !tableId) {
		return { fields: [] };
	}

	const table = await dataGolGetTable.call(this, workspaceId, tableId);
	if (!table) {
		return { fields: [] };
	}

	const fields: ResourceMapperField[] = table.columns
		.filter((column) => column.isDataEditable && column.uiDataType !== 'LINK')
		.map((column) => ({
			id: column.name,
			displayName: column.uiMetadata?.title ?? column.name,
			type: UI_DATA_TYPE_TO_FIELD_TYPE[column.uiDataType],
			required: false,
			display: true,
			defaultMatch: false,
			canBeUsedToMatch: false,
		}));

	return { fields };
}
