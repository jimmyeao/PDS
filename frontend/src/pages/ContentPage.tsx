import { useEffect, useState } from 'react';
import { useContentStore } from '../store/contentStore';

export const ContentPage = () => {
  const { content, fetchContent, createContent, updateContent, deleteContent, isLoading } = useContentStore();
  const [showModal, setShowModal] = useState(false);
  const [editingContent, setEditingContent] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    description: '',
    requiresInteraction: false,
  });

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingContent) {
        await updateContent(editingContent, formData);
        setShowModal(false);
        setEditingContent(null);
        setFormData({ name: '', url: '', description: '', requiresInteraction: false });
        fetchContent();
      } else {
        await createContent(formData);
        setShowModal(false);
        setFormData({ name: '', url: '', description: '', requiresInteraction: false });
        fetchContent();
      }
    } catch (error) {
      // Error handled by store
    }
  };

  const handleEdit = (item: any) => {
    setFormData({
      name: item.name,
      url: item.url,
      description: item.description || '',
      requiresInteraction: item.requiresInteraction || false,
    });
    setEditingContent(item.id);
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this content?')) {
      await deleteContent(id);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Content</h1>
        <button
          onClick={() => {
            setEditingContent(null);
            setFormData({ name: '', url: '', description: '', requiresInteraction: false });
            setShowModal(true);
          }}
          className="btn-primary"
        >
          + Add Content
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-600">Loading content...</p>
        </div>
      ) : content.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-600 mb-4">No content added yet.</p>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary"
          >
            Add Your First Content
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {content.map((item) => (
            <div key={item.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{item.name}</h3>
                {item.requiresInteraction && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Interactive
                  </span>
                )}
              </div>

              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 text-sm break-all mb-3 block"
              >
                {item.url}
              </a>

              {item.description && (
                <p className="text-gray-600 text-sm mb-3">{item.description}</p>
              )}

              <div className="flex gap-2 mt-4 pt-4 border-t dark:border-gray-700">
                <button
                  onClick={() => handleEdit(item)}
                  className="btn-secondary text-sm flex-1"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="btn-danger text-sm flex-1"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Content Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md w-full shadow-xl">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              {editingContent ? 'Edit Content' : 'Add New Content'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Content Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="e.g., Company Website"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URL
                </label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="input"
                  placeholder="https://example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input"
                  rows={3}
                  placeholder="Optional description"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="requiresInteraction"
                  checked={formData.requiresInteraction}
                  onChange={(e) => setFormData({ ...formData, requiresInteraction: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="requiresInteraction" className="ml-2 text-sm text-gray-700">
                  Requires user interaction (e.g., login, MFA)
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingContent(null);
                    setFormData({ name: '', url: '', description: '', requiresInteraction: false });
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1">
                  {editingContent ? 'Update Content' : 'Add Content'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
