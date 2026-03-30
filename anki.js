const AnkiDB = {
  DECK_NAME: "_DataStore",
  MODEL_NAME: "Basic",

  async request(action, params = {}) {
    const res = await fetch("http://localhost:8765", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, version: 6, params }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.result;
  },

  // 读取数据
  async get(key) {
    const noteIds = await this.request("findNotes", {
      query: `deck:"_DataStore" tag:datastore-${key}`,
    });

    if (noteIds.length === 0) return null;

    const notes = await this.request("notesInfo", { notes: noteIds });
    const raw = notes[0].fields.Back.value;

    // 清除 Anki 可能加的 HTML 标签
    const clean = raw.replace(/<[^>]*>/g, "").trim();

    try {
      return JSON.parse(clean);
    } catch {
      return null;
    }
  },

  // 写入数据
  async set(key, data) {
    const noteIds = await this.request("findNotes", {
      query: `deck:"_DataStore" tag:datastore-${key}`,
    });

    const jsonString = JSON.stringify(data);

    if (noteIds.length === 0) {
      // 不存在 → 创建新卡片
      await this.request("addNote", {
        note: {
          deckName: "_DataStore",
          modelName: "Basic",
          fields: {
            Front: `[DATASTORE:${key}]`,
            Back: jsonString,
          },
          tags: ["datastore", `datastore-${key}`],
        },
      });
      console.log(`✅ 创建 [${key}]`);
    } else {
      // 已存在 → 更新
      await this.request("updateNoteFields", {
        note: {
          id: noteIds[0],
          fields: {
            Back: jsonString,
          },
        },
      });
      console.log(`✅ 更新 [${key}]`);
    }
  },

  // 删除数据
  async delete(key) {
    const noteIds = await this.request("findNotes", {
      query: `deck:"_DataStore" tag:datastore-${key}`,
    });
    if (noteIds.length > 0) {
      await this.request("deleteNotes", { notes: noteIds });
      console.log(`🗑️ 删除 [${key}]`);
    }
  },

  // 列出所有 key
  async keys() {
    const noteIds = await this.request("findNotes", {
      query: 'deck:"_DataStore" tag:datastore',
    });
    if (noteIds.length === 0) return [];
    const notes = await this.request("notesInfo", { notes: noteIds });
    return notes
      .map((n) =>
        n.tags
          .find((t) => t.startsWith("datastore-"))
          ?.replace("datastore-", ""),
      )
      .filter(Boolean);
  },
};

// Examples
// // 写入
// await AnkiDB.set('user-settings', {
//   theme: 'dark',
//   fontSize: 16
// });
//
// // 读取
// const settings = await AnkiDB.get('user-settings');
// console.log(settings); // { theme: 'dark', fontSize: 16 }
//
// // 列出所有 key
// const keys = await AnkiDB.keys();
// console.log(keys); // ['user-settings', 'progress', ...]
//
// // 删除
// await AnkiDB.delete('user-settings');
