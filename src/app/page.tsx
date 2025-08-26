export default function Home() {
  return (
    <div className="min-h-screen bg-aravo-subtle">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold bg-aravo-gradient bg-clip-text text-transparent mb-6">
            ZeroFox Compliance
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            AI-powered compliance document analysis for modern organizations
          </p>
          <div className="flex gap-4 justify-center">
            <a
              href="/(app)"
              className="bg-aravo-gradient text-white px-8 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              Get Started
            </a>
            <a
              href="/admin"
              className="border-2 border-aravo-red text-aravo-red px-8 py-3 rounded-lg font-semibold hover:bg-aravo-red hover:text-white transition-colors"
            >
              Admin Panel
            </a>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white rounded-xl p-8 shadow-lg">
            <div className="w-12 h-12 bg-aravo-gradient rounded-lg mb-4"></div>
            <h3 className="text-xl font-semibold mb-3">Document Analysis</h3>
            <p className="text-gray-600">Upload and process compliance documents with AI-powered analysis</p>
          </div>
          
          <div className="bg-white rounded-xl p-8 shadow-lg">
            <div className="w-12 h-12 bg-aravo-accent rounded-lg mb-4"></div>
            <h3 className="text-xl font-semibold mb-3">Framework Mapping</h3>
            <p className="text-gray-600">Map evidence to compliance controls with full source attribution</p>
          </div>
          
          <div className="bg-white rounded-xl p-8 shadow-lg">
            <div className="w-12 h-12 bg-gradient-to-br from-aravo-yellow to-aravo-gold rounded-lg mb-4"></div>
            <h3 className="text-xl font-semibold mb-3">Gap Analysis</h3>
            <p className="text-gray-600">Identify missing controls and compliance gaps with confidence scoring</p>
          </div>
        </div>
      </div>
    </div>
  );
}
