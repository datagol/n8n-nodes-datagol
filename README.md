# n8n-nodes-datagol

This is an n8n community node. It lets you use [DataGOL](https://datagol.ai/) in your n8n workflows.

DataGOL is a data platform where teams organize records in tables made up of rows and typed columns. This node lets a workflow add rows, update rows, and query rows in a table, and lets a workflow start automatically whenever a row is added or updated — so you can sync data between two tables, or between DataGOL and any other n8n-connected system, in either direction.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

[Installation](#installation)
[Operations](#operations)
[Credentials](#credentials)
[Compatibility](#compatibility)
[Usage](#usage)
[Resources](#resources)
[Version history](#version-history)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

Search for **DataGOL** in the community nodes installer, or install directly by package name:

```bash
n8n-nodes-datagol
```

## Operations

### DataGOL (action node)

Resource: **Row**

| Operation | Description |
|---|---|
| Add | Insert a new row into a table. Cell values are mapped through a schema-aware column mapper built from the table's real column list. |
| Update | Update an existing row by its row ID. Only the columns you map are changed; other cells are left untouched. |
| Get Many | Query rows from a table with an optional raw WHERE clause, multi-column sorting, and a return-all or limit/page-size option. |

Both **Add** and **Update** also expose an **Additional Cell Values (JSON)** field for columns the schema mapper does not expose (for example, Link columns) — any keys there are merged on top of the mapped values.

### DataGOL Trigger (trigger node)

A polling trigger that starts a workflow when rows change in a table:

| Watch For | Description |
|---|---|
| Row Added | Fires once per new row that appears in the table. |
| Row Updated | Fires once per row whose selected date/audit column changes. |

The trigger needs a **Date Column** (a DATE-typed column whose value increases when a row is added/updated — DataGOL's own `created_at`/`updated_at` audit columns are recommended and listed first). It uses that column, plus the table's primary key, to detect and de-duplicate changes across polls without emitting the same row twice.

Other trigger options:

- **First Poll Behavior** — on activation, either emit nothing (only react to changes from that point on) or backfill the last N existing rows.
- **Additional Filter** — an extra raw WHERE-clause fragment, ANDed with the internal change-detection filter, to scope the trigger to a subset of rows.
- **Page Size** — pagination size used while the trigger walks through changed rows on a given poll.

## Credentials

This node uses the **DataGOL API** credential type.

Prerequisites:

1. A DataGOL account with access to the workspace/table you want to automate.
2. An API token for that account. Contact your DataGOL workspace admin, or generate one from your DataGOL account settings, if you don't already have one.

To set up the credential in n8n:

1. **Base URL** — your DataGOL API base URL (defaults to `https://be.datagol.ai`; only change this for a self-hosted/on-prem DataGOL deployment).
2. **API Token** — your DataGOL API token. It is sent as the `x-auth-token` header on every request and is never logged.

Use the credential's **Test** button to confirm it can list your workspaces before using it in a workflow.

## Compatibility

- Minimum n8n version: **1.82.0** (requires the resource locator, resource mapper, and list-search UI features used by this node).
- Tested against n8n **1.9x** self-hosted and n8n Cloud.
- Both nodes declare `usableAsTool: true`, so they can also be invoked by AI Agent nodes.

No known version incompatibilities at this time.

## Usage

### Add a row

1. Add a **DataGOL** node, set Resource to **Row** and Operation to **Add**.
2. Pick the **Workspace** and **Table** from the list (or paste an ID).
3. Use **Cell Values** to map incoming data to the table's columns.

### Update a row

Same as Add, but set Operation to **Update** and provide the **Row ID** of the row to change (for example `={{ $json.id }}` when the ID comes from a previous node).

### React to changes with the trigger

Add a **DataGOL Trigger** node, choose **Row Added** or **Row Updated**, pick the table, and select a Date Column (an audit column such as `created_at`/`updated_at` is recommended).

### Avoiding self-triggering loops

A common pattern is: *"When a row changes in Table A, update a related row in Table A or Table B."* If the workflow writes back to the **same** table that a Row Updated trigger is watching, that write bumps the row's own `updated_at` column — which the trigger will see on its next poll, potentially re-running the workflow.

Guard against this by adding a **Filter** node between the trigger and the update action that only lets the item through when the target column is **not already** set to the value you're about to write. That way the loop naturally stops after one extra, harmless poll instead of repeating indefinitely. See [`examples/sync-with-loop-guard.workflow.json`](./examples/sync-with-loop-guard.workflow.json) for a complete example: two triggers (Row Added / Row Updated) feed into an `IF` node that checks a source column, then a `Filter` node that only writes when the destination column is out of sync, then an Update Row action.

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
* [DataGOL](https://datagol.ai/)

## Version history

### 0.1.0

- Initial release: DataGOL action node (Row: Add, Update, Get Many) and DataGOL Trigger node (Row Added, Row Updated).
