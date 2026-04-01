import { google } from "googleapis";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";

// Ensure data dir exists
const tokensPath = path.join(process.cwd(), "data", "google-tokens.json");

export async function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Missing Google Drive OAuth credentials in .env");
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );

  try {
    const tokensRaw = await readFile(tokensPath, "utf-8");
    const tokens = JSON.parse(tokensRaw);
    oauth2Client.setCredentials(tokens);
  } catch (error) {
    // No tokens saved yet
  }

  // Handle automatic refreshing of tokens
  oauth2Client.on("tokens", async (tokens) => {
    try {
      let savedTokens = {};
      try {
        const raw = await readFile(tokensPath, "utf-8");
        savedTokens = JSON.parse(raw);
      } catch (e) { }

      const updated = { ...savedTokens, ...tokens };
      await mkdir(path.dirname(tokensPath), { recursive: true });
      await writeFile(tokensPath, JSON.stringify(updated, null, 2), "utf-8");
      console.log("Updated Google Drive tokens.");
    } catch (e) {
      console.error("Failed to save refreshed tokens", e);
    }
  });

  return oauth2Client;
}

export async function hasValidDriveTokens() {
  try {
    const raw = await readFile(tokensPath, "utf-8");
    const json = JSON.parse(raw);
    return !!json.access_token;
  } catch (e) {
    return false;
  }
}

export async function getGoogleAuthUrl() {
  const oauth2Client = await getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline", // to get a refresh token
    scope: ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/drive.readonly"],
    prompt: "consent", // force consent to always get refresh token
  });
}

export async function handleGoogleCallback(code: string) {
  const oauth2Client = await getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  
  await mkdir(path.dirname(tokensPath), { recursive: true });
  await writeFile(tokensPath, JSON.stringify(tokens, null, 2), "utf-8");
  return tokens;
}

export async function getDriveClient() {
  const auth = await getOAuth2Client();
  return google.drive({ version: "v3", auth });
}

// ----------------------------------------------------
// Folder & File Logistics
// ----------------------------------------------------

async function findOrCreateFolder(client: any, name: string) {
  const safeName = name.replace(/'/g, "\\'");
  const query = `mimeType='application/vnd.google-apps.folder' and name='${safeName}' and trashed=false`;
  const res = await client.files.list({
    q: query,
    spaces: "drive",
    fields: "files(id, name)",
  });
  
  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id;
  }

  const fileMetadata = {
    name: name,
    mimeType: "application/vnd.google-apps.folder",
  };

  const folder = await client.files.create({
    requestBody: fileMetadata,
    fields: "id",
  });

  return folder.data.id;
}

export async function findDriveContents(folderId?: string, searchQuery?: string) {
  const drive = await getDriveClient();
  
  let query = `(mimeType contains 'video/mp4' or mimeType contains 'video/quicktime' or mimeType = 'application/vnd.google-apps.folder') and trashed=false`;

  if (searchQuery) {
    const safeSearch = searchQuery.replace(/'/g, "\\'");
    query += ` and name contains '${safeSearch}'`;
  } else {
    let parentId = folderId;

    if (!parentId) {
      const sourceFolderName = process.env.GOOGLE_DRIVE_SOURCE_FOLDER_NAME;
      parentId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

      if (!parentId && sourceFolderName) {
        const safeFolderName = sourceFolderName.replace(/'/g, "\\'");
        const fQuery = `mimeType='application/vnd.google-apps.folder' and name='${safeFolderName}' and trashed=false`;
        const res = await drive.files.list({ q: fQuery, spaces: "drive", fields: "files(id)" });
        if (res.data.files && res.data.files.length > 0) {
          parentId = res.data.files[0].id || undefined;
        } else {
          parentId = "root";
        }
      } else if (!parentId) {
        parentId = "root";
      }
    }

    query += ` and '${parentId}' in parents`;
  }

  const listRes = await drive.files.list({
    q: query,
    fields: "files(id, name, mimeType, size, thumbnailLink, createdTime)",
    orderBy: "folder, createdTime desc",
    pageSize: 100,
  });

  return listRes.data.files || [];
}

export async function downloadDriveVideo(fileId: string, destFileName: string) {
  const drive = await getDriveClient();
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  
  const destPath = path.join(uploadsDir, destFileName);
  const dest = createWriteStream(destPath);
  
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "stream" }
  );

  await pipeline(res.data, dest);
  return `/uploads/${destFileName}`;
}

export async function exportToDrive({ name, filePaths }: { name: string; filePaths: string[] }) {
  const drive = await getDriveClient();
  
  // Find or create export folder
  const folderName = "Scrubs and Clubs Studio Exports";
  const folderId = await findOrCreateFolder(drive, folderName);
  
  // Create a sub-folder for this specific short
  const subFolderId = await findOrCreateFolder(drive, `${folderName} / ${name}`);

  const uploadedFiles = [];

  for (const filePath of filePaths) {
    const fileName = path.basename(filePath);
    let mimeType = "text/plain";
    if (fileName.endsWith(".mp4")) mimeType = "video/mp4";
    if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) mimeType = "image/jpeg";
    
    // We import createReadStream here because it reads local files for upload
    const { createReadStream } = require("fs");

    const fileMetadata = {
      name: fileName,
      parents: [subFolderId],
    };
    
    const media = {
      mimeType,
      body: createReadStream(filePath),
    };

    const res = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: "id, name, webViewLink",
    });

    if (res.data) {
      uploadedFiles.push(res.data);
    }
  }
  
  return uploadedFiles;
}
