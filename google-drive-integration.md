# Google Drive Integration Guide

This guide covers how to set up Google Drive to pull source videos into Scrubs & Clubs Studio and push finished shorts out.

## 1. Google Cloud Setup (One-Time)

To interact with Google Drive, you need an OAuth Client ID from Google Cloud.

1. Go to the [Google Cloud Console](https://console.cloud.google.com).
2. Create a new Project (e.g., "Scrubs and Clubs Studio").
3. In the sidebar, go to **APIs & Services > Library** and search for **Google Drive API**. Click **Enable**.
4. Go to **APIs & Services > OAuth consent screen**.
   - Select **External** (or Internal if you have a Google Workspace).
   - Fill out the App Name and User Support Email.
   - Click **Save and Continue**.
   - On the **Scopes** page, add `.../auth/drive.file` and `.../auth/drive.readonly`.
   - Add your own Google account email as a **Test User** (required while the app is in "Testing" mode).
5. Go to **APIs & Services > Credentials**.
   - Click **Create Credentials > OAuth client ID**.
   - Select **Web application**.
   - Under **Authorized redirect URIs**, add: `http://localhost:3000/api/integrations/google-drive/callback`
   - Click Create.
6. Copy your **Client ID** and **Client Secret**.

## 2. Environment Variables

Open your `.env` file and add the credentials:

```bash
GOOGLE_CLIENT_ID="your-client-id-here"
GOOGLE_CLIENT_SECRET="your-client-secret-here"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/integrations/google-drive/callback"
```

## 3. App Implementation (To be built)

Once the setup above is complete, the following features will be built into the app:

### Authentication
- A "Connect Google Drive" button on the Settings page.
- Clicking it redirects you to Google to log in.
- The app saves your OAuth tokens locally to `data/google-tokens.json` to keep you logged in.

### Importing Videos
- The Create page (`/`) will have a **Browse Google Drive** button.
- It will list `.mp4` and `.mov` files from a specific folder (e.g., "Raw Footage").
- Selecting a file downloads it directly into your local `public/uploads` folder.

### Exporting Shorts
- The Short Review page will have an **Export to Drive** button.
- Clicking it uploads the rendered `.mp4`, `.srt`, and the text assets to a "Finished Shorts" folder in your Drive.
- This creates an easy handoff point where you can download the final file to your phone or upload it directly to Metricool.
