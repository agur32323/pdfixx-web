export default function SplitGuidePage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12 text-zinc-800">
      <h1 className="text-3xl font-bold mb-6">How to Split PDF Files</h1>

      <p className="mb-4">
        Splitting a PDF allows you to extract specific pages or sections from a document.
        This is useful when you only need part of a file instead of the whole document.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">Steps to split a PDF:</h2>

      <ul className="list-disc ml-6 space-y-2 mb-4">
        <li>Upload your PDF file</li>
        <li>Enter the page range (e.g. 1-3, 5, 8-10)</li>
        <li>Click the "Split" button</li>
        <li>Download the result</li>
      </ul>

      <p className="mb-4">
        You can split a PDF into multiple parts or extract specific pages based on your needs.
      </p>

      <p className="mb-4">
        PDFixx ensures that your files are processed securely and quickly without storing them permanently.
      </p>
    </main>
  );
}