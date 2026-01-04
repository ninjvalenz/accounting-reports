import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Save, 
  X, 
  ChevronDown, 
  ChevronRight,
  Package,
  FolderOpen,
  AlertCircle,
  CheckCircle,
  Loader2,
  ArrowLeft
} from 'lucide-react';

const API_BASE = 'http://localhost:5001/api';

const ProductCategoryMaintenance = ({ onBack }) => {
  // State
  const [categories, setCategories] = useState([]);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [categoryProducts, setCategoryProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Edit states
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editValue, setEditValue] = useState('');
  
  // New item states
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showNewProduct, setShowNewProduct] = useState(null); // category_id
  const [newProduct, setNewProduct] = useState({ name: '', sub_category: '', type_of_sales: '' });
  
  // Saving state
  const [saving, setSaving] = useState(false);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/product-categories`);
      const data = await response.json();
      
      if (response.ok) {
        setCategories(data.categories || []);
      } else {
        setError(data.error || 'Failed to fetch categories');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch products for a category
  const fetchCategoryProducts = async (categoryId) => {
    try {
      const response = await fetch(`${API_BASE}/product-categories/${categoryId}`);
      const data = await response.json();
      
      if (response.ok) {
        setCategoryProducts(prev => ({
          ...prev,
          [categoryId]: data.category.products || []
        }));
      }
    } catch (err) {
      console.error('Failed to fetch products:', err);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Clear messages after 3 seconds
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  // Toggle category expansion
  const toggleCategory = async (categoryId) => {
    if (expandedCategory === categoryId) {
      setExpandedCategory(null);
    } else {
      setExpandedCategory(categoryId);
      if (!categoryProducts[categoryId]) {
        await fetchCategoryProducts(categoryId);
      }
    }
  };

  // ========== CATEGORY CRUD ==========
  
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      setError('Category name is required');
      return;
    }
    
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/product-categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName.trim() })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSuccess(data.message);
        setNewCategoryName('');
        setShowNewCategory(false);
        fetchCategories();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to create category');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCategory = async (categoryId) => {
    if (!editValue.trim()) {
      setError('Category name is required');
      return;
    }
    
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/product-categories/${categoryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editValue.trim() })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSuccess(data.message);
        setEditingCategory(null);
        setEditValue('');
        fetchCategories();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to update category');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (categoryId, categoryName) => {
    if (!window.confirm(`Are you sure you want to delete "${categoryName}"?`)) {
      return;
    }
    
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/product-categories/${categoryId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSuccess(data.message);
        if (expandedCategory === categoryId) {
          setExpandedCategory(null);
        }
        fetchCategories();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to delete category');
    } finally {
      setSaving(false);
    }
  };

  // ========== PRODUCT CRUD ==========
  
  const handleCreateProduct = async (categoryId) => {
    if (!newProduct.name.trim()) {
      setError('Product name is required');
      return;
    }
    
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProduct.name.trim(),
          category_id: categoryId,
          sub_category: newProduct.sub_category.trim() || null,
          type_of_sales: newProduct.type_of_sales.trim() || null
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSuccess(data.message);
        setNewProduct({ name: '', sub_category: '', type_of_sales: '' });
        setShowNewProduct(null);
        fetchCategoryProducts(categoryId);
        fetchCategories(); // Update product count
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to create product');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateProduct = async (productId, categoryId) => {
    if (!editValue.trim()) {
      setError('Product name is required');
      return;
    }
    
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editValue.trim() })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSuccess(data.message);
        setEditingProduct(null);
        setEditValue('');
        fetchCategoryProducts(categoryId);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to update product');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (productId, productName, categoryId) => {
    if (!window.confirm(`Are you sure you want to delete "${productName}"?`)) {
      return;
    }
    
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/products/${productId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSuccess(data.message);
        fetchCategoryProducts(categoryId);
        fetchCategories(); // Update product count
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to delete product');
    } finally {
      setSaving(false);
    }
  };

  // Start editing
  const startEditCategory = (category) => {
    setEditingCategory(category.id);
    setEditValue(category.name);
    setEditingProduct(null);
  };

  const startEditProduct = (product) => {
    setEditingProduct(product.id);
    setEditValue(product.name);
    setEditingCategory(null);
  };

  const cancelEdit = () => {
    setEditingCategory(null);
    setEditingProduct(null);
    setEditValue('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading categories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              title="Back to Dashboard"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Product Categories</h1>
              <p className="text-gray-500 text-sm">Manage product categories and products</p>
            </div>
          </div>
          <button
            onClick={() => {
              setShowNewCategory(true);
              setNewCategoryName('');
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Plus size={20} />
            <span>Add Category</span>
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}
        
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 text-green-700">
            <CheckCircle size={20} />
            <span>{success}</span>
          </div>
        )}

        {/* New Category Form */}
        {showNewCategory && (
          <div className="mb-4 p-4 bg-white border-2 border-blue-200 rounded-lg shadow-sm">
            <h3 className="font-semibold mb-3 text-gray-700">New Category</h3>
            <div className="flex gap-3">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Category name..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateCategory();
                  if (e.key === 'Escape') setShowNewCategory(false);
                }}
              />
              <button
                onClick={handleCreateCategory}
                disabled={saving}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                <span>Save</span>
              </button>
              <button
                onClick={() => setShowNewCategory(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Categories List */}
        <div className="space-y-2">
          {categories.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <FolderOpen size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No categories found</p>
              <p className="text-gray-400 text-sm">Click "Add Category" to create one</p>
            </div>
          ) : (
            categories.map((category) => (
              <div key={category.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {/* Category Row */}
                <div className="flex items-center p-4 hover:bg-gray-50">
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="p-1 hover:bg-gray-200 rounded mr-2"
                  >
                    {expandedCategory === category.id ? (
                      <ChevronDown size={20} className="text-gray-500" />
                    ) : (
                      <ChevronRight size={20} className="text-gray-500" />
                    )}
                  </button>
                  
                  <FolderOpen size={20} className="text-yellow-500 mr-3" />
                  
                  {editingCategory === category.id ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1 px-3 py-1 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdateCategory(category.id);
                          if (e.key === 'Escape') cancelEdit();
                        }}
                      />
                      <button
                        onClick={() => handleUpdateCategory(category.id)}
                        disabled={saving}
                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                      >
                        {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span 
                        className="flex-1 font-medium text-gray-800 cursor-pointer"
                        onClick={() => toggleCategory(category.id)}
                      >
                        {category.name}
                      </span>
                      <span className="text-gray-400 text-sm mr-4">
                        {category.product_count} product{category.product_count !== 1 ? 's' : ''}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEditCategory(category)}
                          className="p-2 text-blue-500 hover:bg-blue-50 rounded transition-colors"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(category.id, category.name)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Expanded Products */}
                {expandedCategory === category.id && (
                  <div className="border-t border-gray-200 bg-gray-50">
                    {/* Products List */}
                    <div className="p-4 pl-12 space-y-2">
                      {(categoryProducts[category.id] || []).length === 0 ? (
                        <p className="text-gray-400 text-sm italic">No products in this category</p>
                      ) : (
                        (categoryProducts[category.id] || []).map((product) => (
                          <div 
                            key={product.id}
                            className="flex items-center p-3 bg-white rounded border border-gray-200 hover:border-gray-300"
                          >
                            <Package size={16} className="text-gray-400 mr-3" />
                            
                            {editingProduct === product.id ? (
                              <div className="flex-1 flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="flex-1 px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleUpdateProduct(product.id, category.id);
                                    if (e.key === 'Escape') cancelEdit();
                                  }}
                                />
                                <button
                                  onClick={() => handleUpdateProduct(product.id, category.id)}
                                  disabled={saving}
                                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                                >
                                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            ) : (
                              <>
                                <span className="flex-1 text-gray-700">{product.name}</span>
                                {product.sub_category && (
                                  <span className="text-gray-400 text-xs mr-2 px-2 py-1 bg-gray-100 rounded">
                                    {product.sub_category}
                                  </span>
                                )}
                                {product.type_of_sales && (
                                  <span className="text-blue-400 text-xs mr-2 px-2 py-1 bg-blue-50 rounded">
                                    {product.type_of_sales}
                                  </span>
                                )}
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => startEditProduct(product)}
                                    className="p-1.5 text-blue-500 hover:bg-blue-50 rounded transition-colors"
                                    title="Edit"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteProduct(product.id, product.name, category.id)}
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ))
                      )}

                      {/* New Product Form */}
                      {showNewProduct === category.id ? (
                        <div className="p-3 bg-blue-50 rounded border-2 border-blue-200">
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={newProduct.name}
                              onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                              placeholder="Product name *"
                              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={newProduct.sub_category}
                                onChange={(e) => setNewProduct({ ...newProduct, sub_category: e.target.value })}
                                placeholder="Sub-category (optional)"
                                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <input
                                type="text"
                                value={newProduct.type_of_sales}
                                onChange={(e) => setNewProduct({ ...newProduct, type_of_sales: e.target.value })}
                                placeholder="Type of sales (optional)"
                                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => {
                                  setShowNewProduct(null);
                                  setNewProduct({ name: '', sub_category: '', type_of_sales: '' });
                                }}
                                className="px-3 py-1.5 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleCreateProduct(category.id)}
                                disabled={saving}
                                className="px-3 py-1.5 bg-green-500 text-white rounded text-sm hover:bg-green-600 disabled:opacity-50 flex items-center gap-1"
                              >
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                <span>Save Product</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setShowNewProduct(category.id);
                            setNewProduct({ name: '', sub_category: '', type_of_sales: '' });
                          }}
                          className="flex items-center gap-2 px-3 py-2 text-blue-500 hover:bg-blue-50 rounded transition-colors text-sm"
                        >
                          <Plus size={16} />
                          <span>Add Product</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Summary */}
        {categories.length > 0 && (
          <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200 text-center text-gray-500 text-sm">
            <span className="font-medium text-gray-700">{categories.length}</span> categories • 
            <span className="font-medium text-gray-700 ml-1">
              {categories.reduce((sum, c) => sum + c.product_count, 0)}
            </span> total products
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductCategoryMaintenance;
