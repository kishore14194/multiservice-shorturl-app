'use client';

import { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import BASE_URL from '../utils/api';

export default function Home() {
  const [url, setUrl] = useState('');
  const [shortenedUrl, setShortenedUrl] = useState('');
  const [urls, setUrls] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editUrl, setEditUrl] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch the list of all shortened URLs
  const fetchUrls = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/get_shorten/all`);
      const data = await res.json();
      if (data.urls) {
        setUrls(data.urls);
      } else {
        toast.error('Failed to fetch URLs.');
      }
    } catch (error) {
      toast.error('Error connecting to server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUrls();
  }, []);

  // Handle form submission to shorten a URL
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url) return toast.error('Please provide a URL.');

    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/shorten/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (data.shortcode) {
        setShortenedUrl(`${BASE_URL}/shorten/${data.shortcode}`);
        setUrl('');
        toast.success('URL shortened successfully!');
        fetchUrls();  // Refresh the URL list
      } else {
        toast.error('Failed to shorten URL.');
      }
    } catch (error) {
      toast.error('Error connecting to server.');
    } finally {
      setLoading(false);
    }
  };

  // Handle URL deletion
  const handleDelete = async (shortcode) => {
    if (!confirm('Are you sure you want to delete this URL?')) return;
    setLoading(true);
    try {
      await fetch(`${BASE_URL}/shorten/${shortcode}`, { method: 'DELETE' });
      toast.success('Deleted successfully!');
      fetchUrls();
    } catch {
      toast.error('Failed to delete.');
    } finally {
      setLoading(false);
    }
  };

  // Handle URL update
  const handleUpdate = async (shortcode) => {
    if (!editUrl) return toast.error('Please provide a URL to update.');

    setLoading(true);
    try {
      await fetch(`${BASE_URL}/shorten/${shortcode}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: editUrl }),
      });
      toast.success('Updated successfully!');
      setEditing(null);
      setEditUrl('');
      fetchUrls();
    } catch {
      toast.error('Failed to update.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 p-8">
      <Toaster />
      <h1 className="text-5xl font-extrabold text-center text-blue-700 mb-10">Short URL Manager 🚀</h1>

      {/* Shorten URL Form */}
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl mx-auto mb-12">
        <form
          className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-4"
          onSubmit={handleSubmit}
        >
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste your URL here..."
            className="flex-1 p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition"
            disabled={loading}
          >
            {loading ? 'Shortening...' : 'Shorten ✂️'}
          </button>
        </form>

        {shortenedUrl && (
          <div className="mt-6 text-center">
            <p className="text-green-700 font-semibold">Your Short URL:</p>
            <a
              href={shortenedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 underline break-words"
            >
              {shortenedUrl}
            </a>
          </div>
        )}
      </div>

      {/* All URLs List */}
      {loading ? (
        <div className="text-center text-xl font-bold text-blue-700">Loading...</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {urls.map((item) => (
            <div
              key={item.shortcode}
              className="bg-white p-6 rounded-2xl shadow-lg flex flex-col justify-between hover:shadow-2xl transition"
            >
              <div>
                <p className="text-gray-600 text-sm mb-1">Shortcode:</p>
                <p className="font-mono text-blue-700 mb-2">{item.shortcode}</p>

                {editing === item.shortcode ? (
                  <>
                    <input
                      value={editUrl}
                      onChange={(e) => setEditUrl(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-xl mb-3"
                    />
                  </>
                ) : (
                  <>
                    <p className="text-gray-600 text-sm mb-1">Original URL:</p>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 underline break-words"
                    >
                      {item.url}
                    </a>
                  </>
                )}
              </div>

              <div className="mt-4 flex space-x-3">
                {editing === item.shortcode ? (
                  <button
                    onClick={() => handleUpdate(item.shortcode)}
                    className="flex-1 bg-green-600 text-white py-2 rounded-xl hover:bg-green-700"
                    disabled={loading}
                  >
                    {loading ? 'Saving...' : 'Save'}
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setEditing(item.shortcode);
                      setEditUrl(item.url);
                    }}
                    className="flex-1 bg-yellow-500 text-white py-2 rounded-xl hover:bg-yellow-600"
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={() => handleDelete(item.shortcode)}
                  className="flex-1 bg-red-500 text-white py-2 rounded-xl hover:bg-red-600"
                  disabled={loading}
                >
                  {loading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
