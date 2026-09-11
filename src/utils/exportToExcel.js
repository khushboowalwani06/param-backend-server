import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

export const exportToExcel = async (data, filename = 'Export', sheetName = 'Sheet1') => {
  if (!data || data.length === 0) {
    Alert.alert("Export Error", "No data available to export.");
    return;
  }
  
  try {
    // Excel cells have a hard limit of 32,767 characters.
    // Sanitize data to truncate any massive strings (e.g., base64 images, large JSON blocks)
    const sanitizedData = data.map(row => {
      if (typeof row !== 'object' || row === null) return row;
      const newRow = { ...row };
      for (const key in newRow) {
        if (typeof newRow[key] === 'string' && newRow[key].length > 32000) {
          newRow[key] = newRow[key].substring(0, 32000) + '... [TRUNCATED]';
        } else if (typeof newRow[key] === 'object' && newRow[key] !== null) {
          // Flatten or stringify nested objects safely
          const strVal = JSON.stringify(newRow[key]);
          newRow[key] = strVal.length > 32000 ? strVal.substring(0, 32000) + '... [TRUNCATED]' : strVal;
        }
      }
      return newRow;
    });

    const worksheet = XLSX.utils.json_to_sheet(sanitizedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    
    // Write the file as base64 string
    const wbout = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
    
    const uri = FileSystem.documentDirectory + `${filename}.xlsx`;
    
    await FileSystem.writeAsStringAsync(uri, wbout, {
      encoding: FileSystem.EncodingType.Base64
    });
    
    await Sharing.shareAsync(uri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Share exported data',
      UTI: 'com.microsoft.excel.xlsx'
    });
  } catch (error) {
    console.error('Export failed:', error);
    Alert.alert("Export Failed", `Details: ${error.message || String(error)}`);
  }
};
