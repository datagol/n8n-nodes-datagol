# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-08-19

### Added

- Initial release.
- **Credential**: DataGOL API (base URL + `x-auth-token` API token).
- **DataGOL** action node (resource: Row):
  - Add — insert a new row into a workbook.
  - Update — update an existing row by ID.
  - Get Many — query rows with a raw WHERE clause, sorting, and pagination.
- **DataGOL Trigger** node (polling):
  - Row Added — fires when new rows appear.
  - Row Updated — fires when existing rows change.
