const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const WEBSITE_DIR = path.join(__dirname, '../../website');
const PUBLISHED_DIR = path.join(__dirname, '../../published');

function datestamp() {
  return new Date().toISOString().slice(0, 10);
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function publish(item) {
  if (item.type === 'WEBSITE_EDIT') {
    await publishWebsiteEdit(item);
  } else if (item.type === 'BLOG_POST') {
    await publishBlogPost(item);
  } else {
    throw new Error(`publisher.publish: unexpected type ${item.type}`);
  }
}

async function publishWebsiteEdit(item) {
  const meta = item.metadata || {};
  const targetFile = meta.targetFile;

  if (!targetFile) {
    throw new Error(`WEBSITE_EDIT item "${item.title}" has no metadata.targetFile`);
  }

  const destPath = path.join(WEBSITE_DIR, targetFile);

  if (!fs.existsSync(path.dirname(destPath))) {
    throw new Error(`Target directory does not exist: ${path.dirname(destPath)}`);
  }

  // If item.body is a full replacement, write it; otherwise log for manual apply
  if (meta.fullReplacement) {
    fs.writeFileSync(destPath, item.body, 'utf8');
    console.log(`[publisher] Wrote website edit to ${targetFile}`);
  } else {
    // Write a patch file for manual review
    const patchDir = path.join(__dirname, '../../agent-state/pending-patches');
    fs.mkdirSync(patchDir, { recursive: true });
    const patchFile = path.join(patchDir, `${datestamp()}_${slugify(item.title)}.txt`);
    const content = `# Website Edit: ${item.title}\n# Target: ${targetFile}\n# Created: ${item.createdAt}\n\n${item.body}`;
    fs.writeFileSync(patchFile, content);
    console.log(`[publisher] Patch written to ${patchFile} — apply manually`);
    item.metadata = { ...meta, patchFile: path.relative(process.cwd(), patchFile) };
  }
}

async function publishBlogPost(item) {
  fs.mkdirSync(PUBLISHED_DIR, { recursive: true });

  const filename = `${datestamp()}_${slugify(item.title)}.md`;
  const destPath = path.join(PUBLISHED_DIR, filename);

  const frontmatter = `---\ntitle: "${item.title}"\ndate: "${datestamp()}"\nstatus: published\n---\n\n`;
  fs.writeFileSync(destPath, frontmatter + item.body, 'utf8');
  console.log(`[publisher] Blog post written to published/${filename}`);

  item.metadata = { ...item.metadata, publishedFile: `published/${filename}` };

  // Attempt a build if a build script exists
  const buildScript = path.join(__dirname, '../../package.json');
  if (fs.existsSync(buildScript)) {
    const pkg = JSON.parse(fs.readFileSync(buildScript, 'utf8'));
    if (pkg.scripts?.build) {
      await runCommand('npm run build', path.join(__dirname, '../..'));
    }
  }
}

function runCommand(cmd, cwd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr || error.message));
      else resolve(stdout);
    });
  });
}

module.exports = { publish };
