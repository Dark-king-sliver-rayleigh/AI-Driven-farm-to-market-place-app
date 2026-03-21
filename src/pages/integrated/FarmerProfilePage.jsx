import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { profileAPI } from '../../services/api';

/**
 * Farmer Profile Page
 * Edit profile info: name, address, farm area, profile photo
 */
export function FarmerProfilePage() {
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [showPhotoMenu, setShowPhotoMenu] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    farmArea: '',
    profilePhoto: ''
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Load profile data on mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        const response = await profileAPI.getProfile();
        const userData = response.user;
        setFormData({
          name: userData.name || '',
          address: userData.address || '',
          farmArea: userData.farmArea || '',
          profilePhoto: userData.profilePhoto || ''
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setSuccess(null);
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setFormData(prev => ({ ...prev, profilePhoto: event.target.result }));
      setError(null);
      setSuccess(null);
    };
    reader.readAsDataURL(file);
  };

  // Open camera with front-facing (selfie) mode
  const openCamera = async () => {
    setShowPhotoMenu(false);
    setCameraError(null);
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      setCameraStream(stream);
      // Attach stream to video element after render
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch (err) {
      console.error('Camera access failed:', err);
      setCameraError('Unable to access camera. Please check permissions and try again.');
    }
  };

  // Capture photo from video stream
  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    // Mirror the image for selfie
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setFormData(prev => ({ ...prev, profilePhoto: dataUrl }));
    setError(null);
    setSuccess(null);
    closeCamera();
  };

  // Stop camera stream and close modal
  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
    setCameraError(null);
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await profileAPI.updateProfile({
        name: formData.name.trim(),
        address: formData.address.trim(),
        farmArea: formData.farmArea.trim(),
        profilePhoto: formData.profilePhoto
      });

      // Update auth context if available
      if (updateUser && response.user) {
        updateUser(response.user);
      }

      setSuccess('Profile updated successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/farmer/settings"
          className="text-2xl text-gray-600 hover:text-gray-800"
        >
          ←
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">👤 My Profile</h1>
      </div>

      {/* Profile Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600">
            {error}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-600">
            {success}
          </div>
        )}

        {/* Profile Photo */}
        <div className="flex flex-col items-center">
          <div className="relative mb-3">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 border-4 border-white shadow-lg">
              {formData.profilePhoto ? (
                <img
                  src={formData.profilePhoto}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl text-gray-400">
                  👤
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowPhotoMenu(prev => !prev)}
              className="absolute bottom-0 right-0 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-green-600"
            >
              📷
            </button>
          </div>

          {/* Photo source menu */}
          {showPhotoMenu && (
            <div className="mt-1 mb-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden w-56">
              <button
                type="button"
                onClick={openCamera}
                className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-green-50 transition-colors"
              >
                <span className="text-xl">📸</span>
                <span className="text-sm font-medium text-gray-700">Take Selfie</span>
              </button>
              <hr className="border-gray-100" />
              <button
                type="button"
                onClick={() => {
                  setShowPhotoMenu(false);
                  fileInputRef.current?.click();
                }}
                className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-green-50 transition-colors"
              >
                <span className="text-xl">🖼️</span>
                <span className="text-sm font-medium text-gray-700">Choose from Gallery</span>
              </button>
            </div>
          )}

          {/* Hidden file input for gallery */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="hidden"
          />
          {/* Hidden canvas for photo capture */}
          <canvas ref={canvasRef} className="hidden" />
          <p className="text-xs text-gray-500">Tap to change photo</p>
        </div>

        {/* Mobile Number (read-only) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Mobile Number
          </label>
          <input
            type="text"
            value={user?.phone || ''}
            disabled
            className="w-full px-4 py-3 text-lg border-2 border-gray-200 rounded-xl bg-gray-100 text-gray-600"
          />
          <p className="text-xs text-gray-500 mt-1">Mobile number cannot be changed</p>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Full Name
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            disabled={saving}
            className="w-full px-4 py-3 text-lg border-2 border-gray-200 rounded-xl focus:border-green-500 outline-none transition-colors"
            placeholder="Enter your name"
          />
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Address
          </label>
          <textarea
            name="address"
            value={formData.address}
            onChange={handleInputChange}
            disabled={saving}
            rows={3}
            className="w-full px-4 py-3 text-lg border-2 border-gray-200 rounded-xl focus:border-green-500 outline-none transition-colors resize-none"
            placeholder="Enter your address"
          />
        </div>

        {/* Farm Area */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Farm Area / Location
          </label>
          <input
            type="text"
            name="farmArea"
            value={formData.farmArea}
            onChange={handleInputChange}
            disabled={saving}
            className="w-full px-4 py-3 text-lg border-2 border-gray-200 rounded-xl focus:border-green-500 outline-none transition-colors"
            placeholder="e.g., 5 acres in Karnataka"
          />
        </div>

        {/* Save Button */}
        <button
          type="submit"
          disabled={saving}
          className={`w-full py-4 rounded-xl font-bold text-lg text-white transition-all ${
            saving
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-xl'
          }`}
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </span>
          ) : (
            '✓ Save Changes'
          )}
        </button>
      </form>

      {/* Camera Modal */}
      {showCamera && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex flex-col items-center justify-center">
          {/* Close button */}
          <button
            type="button"
            onClick={closeCamera}
            className="absolute top-4 right-4 w-10 h-10 bg-white bg-opacity-20 text-white rounded-full flex items-center justify-center text-2xl hover:bg-opacity-40 z-10"
          >
            ✕
          </button>

          {cameraError ? (
            <div className="text-center p-6">
              <p className="text-white text-lg mb-4">{cameraError}</p>
              <button
                type="button"
                onClick={closeCamera}
                className="px-6 py-3 bg-white text-gray-800 rounded-xl font-medium"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              {/* Live camera preview */}
              <div className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-full overflow-hidden border-4 border-white shadow-2xl mb-8">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
              </div>
              <p className="text-white text-sm mb-4 opacity-80">Position your face in the circle</p>
              {/* Capture button */}
              <button
                type="button"
                onClick={capturePhoto}
                className="w-20 h-20 rounded-full border-4 border-white bg-white bg-opacity-30 hover:bg-opacity-50 transition-all flex items-center justify-center shadow-lg"
              >
                <div className="w-14 h-14 rounded-full bg-white" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
