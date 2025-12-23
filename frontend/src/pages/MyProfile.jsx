import React, { useContext, useState, useRef } from 'react';
import { SettingsContext } from '../context/SettingsContext';
import axios from 'axios';
import { getApiUrl } from '../utils/apiConfig';
import { UserCircle, Camera, Upload, X } from 'lucide-react';
import { AvatarEditor } from '../components/AvatarEditor';

export default function MyProfile() {
  const API = getApiUrl();
  const { user, setUser } = useContext(SettingsContext);
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showAvatarEditor, setShowAvatarEditor] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const pickFromGallery = () => {
    fileInputRef.current?.click();
  };

  const takePhoto = () => {
    cameraInputRef.current?.click();
  };

  const handleAvatarSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!file.type.startsWith('image/') || !allowedTypes.includes(file.type.toLowerCase())) {
      alert('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      alert('Profile picture must be ≤ 10MB');
      return;
    }

    // Read as data URL
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      
      // Validate data URL
      if (!dataUrl || !dataUrl.startsWith('data:image/')) {
        alert('Failed to read image file. Please try a different image.');
        return;
      }

      setSelectedImage(dataUrl);
      setShowAvatarEditor(true);
    };
    reader.onerror = () => {
      alert('Failed to read the selected file. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarSaved = async (result) => {
    if (!result?.image) return;

    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('avatar', result.image);

      const response = await axios.put(`${API}/api/users/me/avatar`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data?.user) {
        setUser(response.data.user);
        alert('Profile picture updated successfully!');
        
        // Refresh feed to show updated avatar to other users
        if (window.refreshFeed) {
          window.refreshFeed();
        }
      }
    } catch (err) {
      console.error('Failed to upload avatar:', err);
      alert('Failed to update profile picture: ' + (err.response?.data?.message || err.message));
    } finally {
      setUploading(false);
      setShowAvatarEditor(false);
      setSelectedImage(null);
    }
  };

  const removeAvatar = async () => {
    if (!confirm('Are you sure you want to remove your profile picture?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/api/users/me/avatar`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setUser({ ...user, avatarUrl: '', avatarSizes: { sm: '', md: '', lg: '' } });
      alert('Profile picture removed successfully!');
      
      // Refresh feed to show removed avatar
      if (window.refreshFeed) {
        window.refreshFeed();
      }
    } catch (err) {
      console.error('Failed to remove avatar:', err);
      alert('Failed to remove profile picture: ' + (err.response?.data?.message || err.message));
    }
  };

  if (!user) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">My Profile</h1>

      {/* Profile Picture Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Profile Picture</h2>

        <div className="flex items-center gap-6 mb-4">
          <div className="relative">
            {user.avatarUrl ? (
              <img
                src={`${API}${user.avatarUrl}?t=${Date.now()}`}
                alt="Profile"
                className="w-24 h-24 rounded-full object-cover border-4 border-gray-200 dark:border-gray-600"
                onError={(e) => e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iNDAiIGN5PSI0MCIgcj0iNDAiIGZpbGw9IiNFNUU3RUIiLz4KPHBhdGggZD0iTTQwIDQwQzQ1LjUyMjggNDAgNTAgMzQuNDc3MiA1MCAyOUM1MCAyMy40NzcyIDQ1LjUyMjggMTggNDAgMThDMzQuNDc3MiAxOCAzMCAyMy40NzcyIDMwIDI5QzMwIDM0LjQ3NzIgMzQuNDc3MiAzNC40NzcyIDQwIDQwIDQwIDQwWiIgZmlsbD0iIzlDQTQ5RiIvPgo8cGF0aCBkPSJNNjAgNTJDNTYgNDYuODYzNiA0MCA0MiA0MCA0Mkg0MEMxMy41NzI5IDQyIDEwIDQ2Ljg2MzYgMTAgNTJWODJINjBWNTRaIiBmaWxsPSIjOUNBNEFGIi8+Cjwvc3ZnPgo='}
              />
            ) : (
              <UserCircle className="w-24 h-24 text-gray-400" />
            )}
          </div>

          <div className="flex-1">
            <div className="space-y-2">
              <button
                onClick={pickFromGallery}
                disabled={uploading}
                className="w-full flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50"
              >
                <Upload size={16} />
                Choose from Gallery
              </button>

              <button
                onClick={takePhoto}
                disabled={uploading}
                className="w-full flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50"
              >
                <Camera size={16} />
                Take Photo
              </button>

              {user.avatarUrl && (
                <button
                  onClick={removeAvatar}
                  className="w-full flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                >
                  <X size={16} />
                  Remove Picture
                </button>
              )}
            </div>
          </div>
        </div>

        {uploading && (
          <div className="text-center text-blue-600">
            <div className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2"></div>
            Uploading...
          </div>
        )}
      </div>

      {/* Profile Information */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Profile Information</h2>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded border">
              {user.name || 'Not set'}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Username</label>
            <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded border">
              {user.username}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded border capitalize">
              {user.role}
            </div>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-500">
          To edit your name and username, go to <strong>Settings</strong> in the sidebar.
        </div>
      </div>

      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        onChange={handleAvatarSelected}
        accept="image/*"
        type="file"
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        onChange={handleAvatarSelected}
        accept="image/*"
        capture="environment"
        type="file"
        className="hidden"
      />

      {/* Avatar Editor Modal */}
      {showAvatarEditor && selectedImage && (
        <AvatarEditor
          initialImage={selectedImage}
          onClose={() => { setShowAvatarEditor(false); setSelectedImage(null); }}
          onSaved={handleAvatarSaved}
        />
      )}
    </div>
  );
}