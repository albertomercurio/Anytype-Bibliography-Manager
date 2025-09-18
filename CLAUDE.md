Goal

I want to build an automation framework to manage references in my Anytype research space. This framework should:
	•	Create new Article or Book objects in Anytype directly from a DOI (or DOI + PDF).
	•	Automatically fetch bibliographic metadata (authors, title, journal, etc.) and generate a properly formatted BibTeX entry.
	•	Detect and handle potential duplicates (authors, journals, articles).
	•	Optionally use AI (Claude code or similar) for tasks like duplicate resolution and paper summarization.

The tool should be clean, simple to use, and platform-agnostic (works across desktop, possibly mobile).

⸻

Core Requirements

1. Reference Creation
	•	Input: DOI (mandatory) and optionally a PDF file.
	•	Metadata source: use CrossRef API or better alternatives if available.
	•	Create the corresponding Article or Book object in Anytype.
	•	Attach the PDF (if provided) to the relevant object property.

2. BibTeX Generation
	•	Extract BibTeX from API response.
	•	Apply the following modifications:
        •	Title field: wrap in double curly brackets {{ Title }} to preserve capitalization. Confirm if modern LaTeX still requires this.
        •	Citation key: format as LastYYYYTitle, where:
        •	Last = last name of first author (ASCII only, no accents/special chars).
        •	YYYY = publication year.
        •	Title = first word of the title.
	•	Confirm whether modern LaTeX can handle special characters.
	•	Format BibTeX as multi-line for readability (not a single long string).

3. Duplicate Detection

The system must check for duplicates before writing to Anytype:
	•	Articles:
	    •	Compare DOI (case-insensitive).
	•	Authors:
        •	Prefer ORCID if available.
        •	If not, compare last name.
        •	Handle abbreviations (e.g. Salvatore Savasta vs. S. Savasta).
        •	Ask user whether to: abort, use existing, or create new.
	•	Journals:
        •	Distinguish clearly between different journals (e.g. Physical Review X vs Physical Review Letters).
        •	Detect abbreviations (e.g. Phys. Rev. Lett. = Physical Review Letters), but accept ambiguity when unavoidable.

4. AI Integration (Optional)
	•	Use Claude (or another AI helper) for:
	•	Resolving duplicates more intelligently.
	•	Summarizing papers (from PDF).

⸻

Setup
	1.	Anytype API
        •	User must configure authentication and space definition such as Object Types names.
        •	Reference: Anytype API docs: https://developers.anytype.io/docs/reference/2025-05-20/anytype-api
	2.	Environment
        •	If using Python: prefer uv for isolated environments (evaluate vs Poetry).
        •	If using Node.js/TypeScript: ensure dependencies are similarly confined (no global pollution).
	3.	Framework Choice
        •	Must be platform-agnostic and easy to deploy. If python clearly wins, go for it.
        •	Options:
            •	Python script
            •	Node.js/TypeScript project
            •	Bash wrapper
            •	Local server with API endpoints
        •	Mobile support would be ideal → consider TypeScript if future-proofing is important.

⸻

Next Steps
	•	Study the Anytype API documentation thoroughly: https://developers.anytype.io/docs/reference/2025-05-20/anytype-api
	•	Decide on the framework/language (Python vs TypeScript).
	•	Implement DOI → Anytype object pipeline.
	•	Add BibTeX post-processing rules.
	•	Build duplicate detection layer.
	•	(Optional) Integrate AI assistance.

⸻
