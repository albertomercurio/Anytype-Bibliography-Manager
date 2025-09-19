# Test Suite for Anytype Bibliography Manager

This directory contains comprehensive tests for the Anytype Bibliography Manager.

## Quick Tests

Run fast validation tests without requiring API access:

```bash
npm run test:quick
```

These tests validate:
- Text utility functions (normalization, name parsing, abbreviation detection)
- BibTeX formatting and parsing
- Core logic without external dependencies

## Simple Integration Tests (Recommended)

Run focused integration tests that verify core functionality:

```bash
npm run test:simple
```

These tests validate:
- DOI resolution from CrossRef/DataCite APIs
- BibTeX generation with proper formatting
- Anytype API connection and basic queries
- Duplicate detection functionality

**Status**: ✅ Working correctly

## Full Integration Tests

Run complete end-to-end tests with temporary space creation:

```bash
npm run test:integration
```

**Note**: This test creates a temporary space with a unique name like `BibTest-1234567890`. The Anytype API does not support programmatic space deletion, so you'll need to manually delete test spaces from the Anytype UI if desired.

### What the Integration Tests Do

1. **Create Temporary Space**: Creates a space called "BibTest-{timestamp}" for testing
2. **Setup Object Types**: Creates Article, Person, Journal, and Book types with required properties
3. **Add Test DOIs**: Processes the specified DOIs in order:
   - `10.1016/j.aop.2011.06.004`
   - `10.1140/epjp/s13360-022-03571-0`
   - `10.1103/PhysRevLett.130.123601`
   - `10.21468/SciPostPhys.17.1.027`
   - `10.1103/physreva.98.053834`
   - `10.1103/physrevlett.111.053603`
   - `10.1038/ncomms10988`
   - `10.1038/nature08005`
   - `10.1038/s41567-025-02989-4`
   - `10.1038/nphoton.2014.192`

4. **Test Duplicate Detection**: Attempts to add the same DOIs again and verifies they are rejected
5. **Verify Uniqueness**: Checks that all authors and journals are unique with no duplicates
6. **Validate BibTeX**: Ensures all generated BibTeX entries are properly formatted
7. **Cleanup**: Deletes the test space when finished

### Prerequisites for Integration Tests

1. Have Anytype desktop app running
2. Have run `anytype-bib setup` to configure API access
3. Ensure your Anytype API is accessible

### Test Output

The integration tests provide detailed output including:
- Progress indicators for each step
- Success/failure status for each DOI
- Duplicate detection results
- Author and journal uniqueness verification
- BibTeX validation results
- Final summary with pass/fail counts

### Safety

- Tests run in an isolated temporary space
- Original data is never affected
- Test space is automatically cleaned up
- Uses a separate test configuration

## Manual Testing

You can also run individual test components:

```bash
# Run only integration tests
tsx test/run-tests.ts integration

# Run only quick tests
tsx test/run-tests.ts quick

# Show help
tsx test/run-tests.ts --help
```

## Test Structure

- `integration.test.ts` - Main integration test suite
- `run-tests.ts` - Test runner with CLI interface
- `README.md` - This documentation

## Expected Results

When all tests pass, you should see:
- All 10 DOIs successfully added
- All 10 duplicates properly rejected
- Unique authors and journals (no duplicates)
- Valid BibTeX for all articles
- Clean test space cleanup

## Manual Cleanup of Test Spaces

After running integration tests, you may want to clean up test spaces manually:

1. **Open Anytype Desktop App**
2. **Switch to the test space** (look for spaces named `BibTest-{timestamp}`)
3. **Go to Space Settings** → Click the `...` menu → **Delete Space**
4. **Confirm deletion** (Note: This cannot be undone)

You can identify test spaces by their names following the pattern `BibTest-1234567890` where the number is a timestamp.

## Troubleshooting

If tests fail:

1. **API Connection Issues**: Verify Anytype is running and API is accessible
2. **Configuration Issues**: Run `anytype-bib setup` again
3. **DOI Resolution Failures**: Some DOIs might be temporarily unavailable
4. **Space Creation Failures**: Check API permissions and rate limits
5. **Too Many Test Spaces**: Clean up old test spaces manually from Anytype UI

The test suite is designed to be robust and will report specific error messages for each failure type.