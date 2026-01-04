import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './ProductCategoryMaintenance.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

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
  const [showNewProduct, setShowNewProduct] = useState(null);
  const [newProduct, setNewProduct] = useState({ name: '', sub_category: '', type_of_sales: '' });
  
  // Saving state
  const [saving, setSaving] = useState(false);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/product-categories`);
      setCategories(response.data.categories || []);
      setError(null);
    } catch (err) {
      setError('Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch products for a category
  const fetchCategoryProducts = async (categoryId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/product-categories/${categoryId}`);
      setCategoryProducts(prev => ({
        ...prev,
        [categoryId]: response.data.category.products || []
      }));
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
      const response = await axios.post(`${API_BASE_URL}/product-categories`, {
        name: newCategoryName.trim()
      });
      setSuccess(response.data.message);
      setNewCategoryName('');
      setShowNewCategory(false);
      fetchCategories();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create category');
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
      const response = await axios.put(`${API_BASE_URL}/product-categories/${categoryId}`, {
        name: editValue.trim()
      });
      setSuccess(response.data.message);
      setEditingCategory(null);
      setEditValue('');
      fetchCategories();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update category');
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
      const response = await axios.delete(`${API_BASE_URL}/product-categories/${categoryId}`);
      setSuccess(response.data.message);
      if (expandedCategory === categoryId) {
        setExpandedCategory(null);
      }
      fetchCategories();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete category');
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
      const response = await axios.post(`${API_BASE_URL}/products`, {
        name: newProduct.name.trim(),
        category_id: categoryId,
        sub_category: newProduct.sub_category.trim() || null,
        type_of_sales: newProduct.type_of_sales.trim() || null
      });
      setSuccess(response.data.message);
      setNewProduct({ name: '', sub_category: '', type_of_sales: '' });
      setShowNewProduct(null);
      fetchCategoryProducts(categoryId);
      fetchCategories();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create product');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateProduct = async (productId, categoryId) => {
    if (!editValue.name || !editValue.name.trim()) {
      setError('Product name is required');
      return;
    }
    
    setSaving(true);
    try {
      const response = await axios.put(`${API_BASE_URL}/products/${productId}`, {
        name: editValue.name.trim(),
        sub_category: editValue.sub_category?.trim() || null,
        type_of_sales: editValue.type_of_sales || null
      });
      setSuccess(response.data.message);
      setEditingProduct(null);
      setEditValue('');
      fetchCategoryProducts(categoryId);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update product');
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
      const response = await axios.delete(`${API_BASE_URL}/products/${productId}`);
      setSuccess(response.data.message);
      fetchCategoryProducts(categoryId);
      fetchCategories();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete product');
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
    setEditValue({
      name: product.name,
      sub_category: product.sub_category || '',
      type_of_sales: product.type_of_sales || ''
    });
    setEditingCategory(null);
  };

  const cancelEdit = () => {
    setEditingCategory(null);
    setEditingProduct(null);
    setEditValue('');
  };

  if (loading) {
    return (
      <div className="maintenance-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading categories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="maintenance-container">
      {/* Header */}
      <div className="maintenance-header">
        <div className="header-left">
          <button onClick={onBack} className="back-btn">
            ← Back
          </button>
          <div className="header-title">
            <h2>Product Categories</h2>
            <p>Manage product categories and products</p>
          </div>
        </div>
        <button
          onClick={() => {
            setShowNewCategory(true);
            setNewCategoryName('');
          }}
          className="add-btn"
        >
          + Add Category
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="message error-message">
          ⚠️ {error}
        </div>
      )}
      
      {success && (
        <div className="message success-message">
          ✓ {success}
        </div>
      )}

      {/* New Category Form */}
      {showNewCategory && (
        <div className="new-item-form">
          <h3>New Category</h3>
          <div className="form-row">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Category name..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateCategory();
                if (e.key === 'Escape') setShowNewCategory(false);
              }}
            />
            <button onClick={handleCreateCategory} disabled={saving} className="save-btn">
              {saving ? '...' : '💾 Save'}
            </button>
            <button onClick={() => setShowNewCategory(false)} className="cancel-btn">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Categories List */}
      <div className="categories-list">
        {categories.length === 0 ? (
          <div className="empty-state">
            <p>📂 No categories found</p>
            <p className="hint">Click "Add Category" to create one</p>
          </div>
        ) : (
          categories.map((category) => (
            <div key={category.id} className="category-item">
              {/* Category Row */}
              <div className="category-row">
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="expand-btn"
                >
                  {expandedCategory === category.id ? '▼' : '▶'}
                </button>
                
                <span className="category-icon">📁</span>
                
                {editingCategory === category.id ? (
                  <div className="edit-row">
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdateCategory(category.id);
                        if (e.key === 'Escape') cancelEdit();
                      }}
                    />
                    <button onClick={() => handleUpdateCategory(category.id)} disabled={saving} className="save-btn small">
                      {saving ? '...' : '✓'}
                    </button>
                    <button onClick={cancelEdit} className="cancel-btn small">✕</button>
                  </div>
                ) : (
                  <>
                    <span 
                      className="category-name"
                      onClick={() => toggleCategory(category.id)}
                    >
                      {category.name}
                    </span>
                    <span className="product-count">
                      {category.product_count} product{category.product_count !== 1 ? 's' : ''}
                    </span>
                    <div className="action-buttons">
                      <button onClick={() => startEditCategory(category)} className="edit-btn" title="Edit">
                        ✏️
                      </button>
                      <button onClick={() => handleDeleteCategory(category.id, category.name)} className="delete-btn" title="Delete">
                        🗑️
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Expanded Products */}
              {expandedCategory === category.id && (
                <div className="products-container">
                  {(categoryProducts[category.id] || []).length === 0 ? (
                    <p className="no-products">No products in this category</p>
                  ) : (
                    (categoryProducts[category.id] || []).map((product) => (
                      <div key={product.id} className="product-row">
                        <span className="product-icon">📦</span>
                        
                        {editingProduct === product.id ? (
                          <div className="edit-product-form">
                            <div className="edit-form-row">
                              <input
                                type="text"
                                value={editValue.name || ''}
                                onChange={(e) => setEditValue({...editValue, name: e.target.value})}
                                placeholder="Product name *"
                                autoFocus
                              />
                              <input
                                type="text"
                                value={editValue.sub_category || ''}
                                onChange={(e) => setEditValue({...editValue, sub_category: e.target.value})}
                                placeholder="Sub-category"
                              />
                              <select
                                value={editValue.type_of_sales || ''}
                                onChange={(e) => setEditValue({...editValue, type_of_sales: e.target.value})}
                                className="type-select"
                              >
                                <option value="">-- Type --</option>
                                <option value="Domestic">Domestic</option>
                                <option value="Export">Export</option>
                              </select>
                            </div>
                            <div className="edit-form-actions">
                              <button onClick={() => handleUpdateProduct(product.id, category.id)} disabled={saving} className="save-btn small">
                                {saving ? '...' : '✓ Save'}
                              </button>
                              <button onClick={cancelEdit} className="cancel-btn small">✕ Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <span className="product-name">{product.name}</span>
                            {product.sub_category && (
                              <span className="product-tag sub">{product.sub_category}</span>
                            )}
                            {product.type_of_sales && (
                              <span className="product-tag type">{product.type_of_sales}</span>
                            )}
                            <div className="action-buttons">
                              <button onClick={() => startEditProduct(product)} className="edit-btn small" title="Edit">
                                ✏️
                              </button>
                              <button onClick={() => handleDeleteProduct(product.id, product.name, category.id)} className="delete-btn small" title="Delete">
                                🗑️
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  )}

                  {/* New Product Form */}
                  {showNewProduct === category.id ? (
                    <div className="new-product-form">
                      <input
                        type="text"
                        value={newProduct.name}
                        onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                        placeholder="Product name *"
                        autoFocus
                      />
                      <div className="form-row-inline">
                        <input
                          type="text"
                          value={newProduct.sub_category}
                          onChange={(e) => setNewProduct({ ...newProduct, sub_category: e.target.value })}
                          placeholder="Sub-category (optional)"
                        />
                        <select
                          value={newProduct.type_of_sales}
                          onChange={(e) => setNewProduct({ ...newProduct, type_of_sales: e.target.value })}
                          className="type-select"
                        >
                          <option value="">-- Type of Sales --</option>
                          <option value="Domestic">Domestic</option>
                          <option value="Export">Export</option>
                        </select>
                      </div>
                      <div className="form-actions">
                        <button
                          onClick={() => {
                            setShowNewProduct(null);
                            setNewProduct({ name: '', sub_category: '', type_of_sales: '' });
                          }}
                          className="cancel-btn"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleCreateProduct(category.id)}
                          disabled={saving}
                          className="save-btn"
                        >
                          {saving ? '...' : '💾 Save Product'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setShowNewProduct(category.id);
                        setNewProduct({ name: '', sub_category: '', type_of_sales: '' });
                      }}
                      className="add-product-btn"
                    >
                      + Add Product
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Summary */}
      {categories.length > 0 && (
        <div className="summary">
          <strong>{categories.length}</strong> categories • 
          <strong> {categories.reduce((sum, c) => sum + c.product_count, 0)}</strong> total products
        </div>
      )}
    </div>
  );
};

export default ProductCategoryMaintenance;
