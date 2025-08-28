'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'client' | 'demo';
  createdAt: string;
  organizationId?: number;
  organizationName?: string;
}

interface Organization {
  id: number;
  name: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    role: 'client' as 'admin' | 'client' | 'demo',
    organizationId: 1
  });
  const [newUser, setNewUser] = useState({
    email: '',
    name: '',
    role: 'client' as 'admin' | 'client' | 'demo',
    password: '',
    organizationId: 1,
    organizationMode: 'existing' as 'existing' | 'new',
    newOrganizationName: ''
  });
  const router = useRouter();

  useEffect(() => {
    // Check if user is admin
    const token = document.cookie
      .split('; ')
      .find(row => row.startsWith('token='))
      ?.split('=')[1];

    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.role !== 'admin') {
          router.push('/admin');
          return;
        }
      } catch (error) {
        router.push('/login');
        return;
      }
    } else {
      router.push('/login');
      return;
    }

    loadUsers();
    loadOrganizations();
  }, [router]);

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/admin/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadOrganizations = async () => {
    try {
      const response = await fetch('/api/admin/organizations');
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.organizations);
      }
    } catch (error) {
      console.error('Error loading organizations:', error);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newUser.email,
          name: newUser.name,
          password: newUser.password,
          role: newUser.role,
          organizationId: newUser.organizationId,
          organizationMode: newUser.organizationMode,
          newOrganizationName: newUser.newOrganizationName
        }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message || 'User created successfully!');
        setShowCreateForm(false);
        setNewUser({
          email: '',
          name: '',
          role: 'client',
          password: '',
          organizationId: 1,
          organizationMode: 'existing',
          newOrganizationName: ''
        });
        loadUsers();
        // Refresh organizations list in case a new one was created
        loadOrganizations();
      } else {
        const error = await response.json();
        alert(`Error creating user: ${error.error}`);
      }
    } catch (error) {
      alert('Error creating user: Network error');
    } finally {
      setIsCreating(false);
    }
  };

  const startEditUser = (user: User) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      role: user.role,
      organizationId: user.organizationId || 1
    });
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsUpdating(true);

    try {
      const response = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editForm.name,
          role: editForm.role,
          organizationId: editForm.organizationId
        }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message || 'User updated successfully!');
        setEditingUser(null);
        loadUsers();
        loadOrganizations(); // Refresh in case organization changed
      } else {
        const error = await response.json();
        alert(`Error updating user: ${error.error}`);
      }
    } catch (error) {
      alert('Error updating user: Network error');
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('User deleted successfully');
        loadUsers();
      } else {
        const error = await response.json();
        alert(`Error deleting user: ${error.error}`);
      }
    } catch (error) {
      alert('Error deleting user: Network error');
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  const getRoleBadgeColor = (role: string): string => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'client': return 'bg-green-100 text-green-800';
      case 'demo': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
        <div className="text-center py-8 text-gray-500">
          <p>Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-aravo-gradient text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
        >
          ➕ Create New User
        </button>
      </div>

      {/* Edit User Form */}
      {editingUser && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Edit User: {editingUser.email}</h2>
            <button
              onClick={() => setEditingUser(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          
          <form onSubmit={handleUpdateUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email (Read-only)
                </label>
                <input
                  type="email"
                  value={editingUser.email}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as 'admin' | 'client' | 'demo' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="client">Client</option>
                  <option value="demo">Demo</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization
                </label>
                <select
                  value={editForm.organizationId}
                  onChange={(e) => setEditForm({ ...editForm, organizationId: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={editForm.role === 'admin'}
                >
                  {organizations.map(org => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
                {editForm.role === 'admin' && (
                  <p className="text-xs text-gray-500 mt-1">Admin users don't belong to specific organizations</p>
                )}
              </div>
            </div>
            
            <div className="flex space-x-3 pt-4">
              <button
                type="submit"
                disabled={isUpdating}
                className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                  isUpdating
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {isUpdating ? 'Updating...' : 'Update User'}
              </button>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-6 py-2 rounded-lg font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create User Form */}
      {showCreateForm && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Create New User</h2>
            <button
              onClick={() => setShowCreateForm(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'admin' | 'client' | 'demo' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="client">Client</option>
                  <option value="demo">Demo</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization
                </label>
                <div className="space-y-3">
                  {/* Organization Mode Selection */}
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="existing"
                        checked={newUser.organizationMode === 'existing'}
                        onChange={(e) => setNewUser({ ...newUser, organizationMode: e.target.value as 'existing' | 'new' })}
                        className="mr-2"
                      />
                      Use Existing Organization
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="new"
                        checked={newUser.organizationMode === 'new'}
                        onChange={(e) => setNewUser({ ...newUser, organizationMode: e.target.value as 'existing' | 'new' })}
                        className="mr-2"
                      />
                      Create New Organization
                    </label>
                  </div>

                  {/* Existing Organization Dropdown */}
                  {newUser.organizationMode === 'existing' && (
                    <select
                      value={newUser.organizationId}
                      onChange={(e) => setNewUser({ ...newUser, organizationId: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {organizations.map(org => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* New Organization Input */}
                  {newUser.organizationMode === 'new' && (
                    <input
                      type="text"
                      placeholder="Enter new organization name"
                      value={newUser.newOrganizationName}
                      onChange={(e) => setNewUser({ ...newUser, newOrganizationName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required={newUser.organizationMode === 'new'}
                    />
                  )}
                </div>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Minimum 6 characters"
                  minLength={6}
                />
              </div>
            </div>
            
            <div className="flex space-x-3 pt-4">
              <button
                type="submit"
                disabled={isCreating}
                className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                  isCreating
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isCreating ? 'Creating...' : 'Create User'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-6 py-2 rounded-lg font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users List */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          All Users ({users.length})
        </h2>

        {users.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-lg">No users found</p>
            <p className="text-sm mt-1">Create your first user to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className="text-2xl">
                    {user.role === 'admin' ? '👑' : 
                     user.role === 'client' ? '👤' : '🎭'}
                  </div>
                  
                  <div>
                    <div className="font-medium text-gray-900">{user.name}</div>
                    <div className="text-sm text-gray-600 space-x-4">
                      <span>{user.email}</span>
                      <span>ID: {user.id}</span>
                      {user.organizationName && (
                        <span>Org: {user.organizationName}</span>
                      )}
                      <span>Created: {formatDate(user.createdAt)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </span>
                  
                  <button
                    onClick={() => startEditUser(user)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    ✏️ Edit
                  </button>
                  
                  {user.role !== 'admin' && (
                    <button
                      onClick={() => deleteUser(user.id)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      🗑️ Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}