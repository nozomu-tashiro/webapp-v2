/**
 * IndexedDB データ管理ユーティリティ
 * 申込データの保存・取得・編集・削除を担当
 */

const DB_NAME = 'kaketsuke_service_db';
const DB_VERSION = 1;
const STORE_NAME = 'applications';

// IndexedDBを開く
const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      reject(new Error('データベースを開けませんでした'));
    };
    
    request.onsuccess = () => {
      resolve(request.result);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // オブジェクトストアを作成
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        
        // インデックスを作成
        objectStore.createIndex('agentCode', 'agentCode', { unique: false });
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        objectStore.createIndex('submitted', 'submitted', { unique: false });
      }
    };
  });
};

// データを保存
export const saveApplication = async (formData, agentCode) => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const data = {
      agentCode,
      formData,
      timestamp: new Date().toISOString(),
      submitted: false, // 提出済みフラグ（後方互換性のため残す）
      csvExported: false, // CSV出力済みフラグ
      csvExportedAt: null, // CSV出力日時
      pdfGenerated: true
    };
    
    const request = store.add(data);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve({ success: true, id: request.result });
      };
      request.onerror = () => {
        reject(new Error('データの保存に失敗しました'));
      };
    });
  } catch (error) {
    console.error('保存エラー:', error);
    throw error;
  }
};

// 代理店の全データを取得
export const getApplicationsByAgent = async (agentCode) => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('agentCode');
    
    const request = index.getAll(agentCode);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        // 全データを返す（CSV出力済みも含む）
        const allData = request.result || [];
        resolve(allData);
      };
      request.onerror = () => {
        reject(new Error('データの取得に失敗しました'));
      };
    });
  } catch (error) {
    console.error('取得エラー:', error);
    throw error;
  }
};

// 特定のデータを取得
export const getApplicationById = async (id) => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.get(id);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(new Error('データの取得に失敗しました'));
      };
    });
  } catch (error) {
    console.error('取得エラー:', error);
    throw error;
  }
};

// データを更新
export const updateApplication = async (id, formData) => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // 既存データを取得
    const getRequest = store.get(id);
    
    return new Promise((resolve, reject) => {
      getRequest.onsuccess = () => {
        const data = getRequest.result;
        if (!data) {
          reject(new Error('データが見つかりません'));
          return;
        }
        
        // データを更新
        data.formData = formData;
        data.updatedAt = new Date().toISOString();
        
        const updateRequest = store.put(data);
        
        updateRequest.onsuccess = () => {
          resolve({ success: true });
        };
        
        updateRequest.onerror = () => {
          reject(new Error('データの更新に失敗しました'));
        };
      };
      
      getRequest.onerror = () => {
        reject(new Error('データの取得に失敗しました'));
      };
    });
  } catch (error) {
    console.error('更新エラー:', error);
    throw error;
  }
};

// データを削除
export const deleteApplication = async (id) => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.delete(id);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve({ success: true });
      };
      request.onerror = () => {
        reject(new Error('データの削除に失敗しました'));
      };
    });
  } catch (error) {
    console.error('削除エラー:', error);
    throw error;
  }
};

// 重複チェック
export const checkDuplicate = async (agentCode, guaranteeNumber, applicantName, propertyName) => {
  try {
    const applications = await getApplicationsByAgent(agentCode);
    
    return applications.some(app => {
      const data = app.formData;
      
      // 保証番号でチェック
      if (guaranteeNumber && data.guaranteeNumber === guaranteeNumber) {
        return true;
      }
      
      // 申込者名 + 物件名でチェック
      if (applicantName && propertyName &&
          data.applicantName === applicantName &&
          data.propertyName === propertyName) {
        return true;
      }
      
      return false;
    });
  } catch (error) {
    console.error('重複チェックエラー:', error);
    return false;
  }
};

// すべてのデータを提出済みにマーク
export const markAllAsSubmitted = async (agentCode) => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('agentCode');
    
    const request = index.getAll(agentCode);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const allData = request.result || [];
        const now = new Date().toISOString();
        const updatePromises = allData
          .filter(item => !item.csvExported && !item.submitted) // CSV未出力のデータのみ
          .map(item => {
            item.submitted = true; // 後方互換性のため残す
            item.submittedAt = now;
            item.csvExported = true; // CSV出力済みフラグ
            item.csvExportedAt = now; // CSV出力日時
            return store.put(item);
          });
        
        Promise.all(updatePromises)
          .then(() => resolve({ success: true }))
          .catch(() => reject(new Error('提出マークの更新に失敗しました')));
      };
      
      request.onerror = () => {
        reject(new Error('データの取得に失敗しました'));
      };
    });
  } catch (error) {
    console.error('提出マークエラー:', error);
    throw error;
  }
};

// 古いデータを削除（3日以上経過した出力済みデータ）
export const cleanupOldData = async () => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.getAll();
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const allData = request.result || [];
        const now = new Date();
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        
        const deletePromises = allData
          .filter(item => {
            // CSV出力済み（csvExported=true）かつ出力日から3日以上経過したデータを削除
            if (!item.csvExported && !item.submitted) return false; // 両方チェック（後方互換性）
            const exportedDate = item.csvExportedAt ? new Date(item.csvExportedAt) : (item.submittedAt ? new Date(item.submittedAt) : null);
            if (!exportedDate) return false;
            return exportedDate < threeDaysAgo;
          })
          .map(item => store.delete(item.id));
        
        Promise.all(deletePromises)
          .then(() => resolve({ success: true }))
          .catch(() => reject(new Error('古いデータの削除に失敗しました')));
      };
      
      request.onerror = () => {
        reject(new Error('データの取得に失敗しました'));
      };
    });
  } catch (error) {
    console.error('クリーンアップエラー:', error);
    throw error;
  }
};

// データ件数を取得
export const getApplicationCount = async (agentCode) => {
  try {
    const applications = await getApplicationsByAgent(agentCode);
    return applications.length;
  } catch (error) {
    console.error('件数取得エラー:', error);
    return 0;
  }
};

// 全データを削除（再登録時に使用）
export const deleteAllApplications = async () => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    await store.clear(); // 全データ削除
    
    return { success: true };
  } catch (error) {
    console.error('全データ削除エラー:', error);
    throw new Error('データの削除に失敗しました');
  }
};
