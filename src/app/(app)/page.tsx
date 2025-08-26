export default function Dashboard() {
  return (
    <div className="space-y-8">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Compliance Dashboard</h2>
        <p className="text-gray-600">Analyze your compliance documents and frameworks.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Upload Documents</h3>
          <p className="text-gray-600 text-sm">Upload and process compliance documents</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Framework Builder</h3>
          <p className="text-gray-600 text-sm">Create custom compliance frameworks</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Evidence Analysis</h3>
          <p className="text-gray-600 text-sm">View compliance mapping results</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Gap Analysis</h3>
          <p className="text-gray-600 text-sm">Identify compliance gaps</p>
        </div>
      </div>
    </div>
  )
}