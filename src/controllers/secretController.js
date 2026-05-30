const { User, Project, ProjectMember, Secret } = require("../../models");
const crypto = require("crypto");

if (!process.env.MASTER_KEY) {
  throw new Error("MASTER_KEY is not configured");
}

const MASTER_KEY = Buffer.from(process.env.MASTER_KEY, "base64");

if (MASTER_KEY.length !== 32) {
  throw new Error("MASTER_KEY must decode to 32 bytes");
}

function encrypt(data) {
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv("aes-256-gcm", MASTER_KEY, iv);

  const plaintext =
    typeof data === "string" ? data : JSON.stringify(data);

  let encrypted = cipher.update(plaintext, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  const tag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

function decrypt(ciphertext, iv, tag) {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    MASTER_KEY,
    Buffer.from(iv, "base64")
  );

  decipher.setAuthTag(Buffer.from(tag, "base64"));

  let decrypted = decipher.update(Buffer.from(ciphertext, "base64"));
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString("utf8");
}

const saveSecrets = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId, secrets } = req.body;

    const project = await Project.findByPk(projectId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const membership = await ProjectMember.findOne({
      where: {
        userId,
        projectId,
        role: "owner",
      },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "Only owners can manage secrets",
      });
    }

    const encrypted = encrypt(secrets);

    const [secret, created] = await Secret.findOrCreate({
      where: { projectId },
      defaults: {
        projectId,
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        tag: encrypted.tag,
        updatedBy: userId,
      },
    });

    if (!created) {
      await secret.update({
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        tag: encrypted.tag,
        updatedBy: userId,
      });
    }

    return res.status(created ? 201 : 200).json({
      success: true,
      message: created ? "Secrets created" : "Secrets updated",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to save secrets",
    });
  }
};

const getSecrets = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;

    const membership = await ProjectMember.findOne({
      where: {
        userId,
        projectId,
      },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const secret = await Secret.findOne({
      where: { projectId },
    });

    if (!secret) {
      return res.status(200).json({
        success: true,
        secrets: {},
      });
    }

    const plaintext = decrypt(
      secret.ciphertext,
      secret.iv,
      secret.tag
    );

    let parsed;
    try {
      parsed = JSON.parse(plaintext);
    } catch {
      parsed = plaintext;
    }

    return res.status(200).json({
      success: true,
      secrets: parsed,
      updatedAt: secret.updatedAt,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch secrets",
    });
  }
};

module.exports = {
  saveSecrets,
  getSecrets,
};