// 画像サイズぴったりのアートボードを作成し、最適な名前を設定するスクリプト
#target photoshop

// 設定
var VERTICAL_SPACING = 50; // アートボード間の縦の間隔（ピクセル）
var HORIZONTAL_SPACING = 50; // アートボード間の横の間隔（ピクセル）
var MAX_HEIGHT = 10000; // 最大高さ（ピクセル）

// バージョンチェック
function checkVersion() {
    // Photoshop CC 2015 (バージョン16.0)以降でアートボードをサポート
    var version = parseInt(app.version, 10);
    if (version < 16) {
        alert("このスクリプトはPhotoshop CC 2015（バージョン16.0）以降が必要です。\n現在のバージョン: " + app.version);
        return false;
    }
    return true;
}

function main() {
    // バージョンチェック
    if (!checkVersion()) return;

    // ファイル選択ダイアログを表示
    var files = File.openDialog("アートボードに配置する画像を選択してください", "*.jpg;*.jpeg;*.png;*.tif;*.psd;*.gif", true);
    
    if (!files || files.length === 0) return;
    
    // ドキュメントの準備
    var doc;
    if (app.documents.length === 0) {
        // 新規ドキュメント作成
        doc = app.documents.add(5000, 5000, 72, "画像アートボード", NewDocumentMode.RGB);
    } else {
        doc = app.activeDocument;
    }
    
    try {
        // 現在のアートボード位置を取得
        var currentY = 0;
        var columnHeight = 0;
        var currentX = 0;
        var columnMaxWidth = 0; // 現在の列の最大幅を追跡
        var columns = []; // 各列の最大幅を保存する配列
        
        // 既存のアートボードチェック
        if (doc.artboards && doc.artboards.length > 0) {
            var lastArtboard = doc.artboards[doc.artboards.length - 1];
            var rect = lastArtboard.artboardRect;
            currentY = rect[3] + VERTICAL_SPACING; // 下端 + 間隔
            columnHeight = rect[3];
        }
        
        // ファイル名とアートボードの対応を記録
        var artboardLayerMap = [];
        
        // 進捗表示の準備
        var progressWin = new Window("palette", "画像配置中...");
        progressWin.progressBar = progressWin.add("progressbar", undefined, 0, files.length);
        progressWin.progressBar.preferredSize.width = 300;
        progressWin.status = progressWin.add("statictext", undefined, "準備中...");
        progressWin.status.preferredSize.width = 300;
        progressWin.show();
        
        // 各ファイルを処理
        for (var i = 0; i < files.length; i++) {
            // 進捗更新
            progressWin.progressBar.value = i;
            progressWin.status.text = "処理中: " + (i+1) + "/" + files.length;
            progressWin.update();
            
            var currentFile = files[i];
            var fullFileName = decodeURI(currentFile.name);
            
            // ファイル名から拡張子を取り除いたものを作成
            var lastDotIndex = fullFileName.lastIndexOf('.');
            var fileNameWithoutExt = (lastDotIndex !== -1) ? fullFileName.substring(0, lastDotIndex) : fullFileName;
            
            try {
                // 一時的にファイルを開いてサイズを取得
                var tempDoc = app.open(currentFile);
                var imgWidth = tempDoc.width.value;
                var imgHeight = tempDoc.height.value;
                tempDoc.close(SaveOptions.DONOTSAVECHANGES);
                
                // 縦の高さが最大値を超えるか確認
                if (columnHeight + imgHeight > MAX_HEIGHT) {
                    // 現在の列の最大幅を保存
                    columns.push(columnMaxWidth);
                    
                    // 新しい列を開始
                    if (columns.length > 0) {
                        // これまでの列の最大幅を使用して次の列の開始位置を計算
                        currentX = 0;
                        for (var j = 0; j < columns.length; j++) {
                            currentX += columns[j] + HORIZONTAL_SPACING;
                        }
                    }
                    
                    currentY = 0;
                    columnHeight = 0;
                    columnMaxWidth = 0; // 新しい列の最大幅をリセット
                }
                
                // 仮の名前でアートボードを作成
                var artboardLayer = createEmptyArtboard(currentX, currentY, imgWidth, imgHeight, "temp_artboard_" + i);
                
                // 画像をそのアートボードに配置
                var placedLayer = placeImageInArtboard(currentFile, artboardLayer, currentX, currentY);
                
                // 配置したレイヤーの名前を拡張子なしに設定
                placedLayer.name = fileNameWithoutExt;
                
                // マッピング情報を保存
                artboardLayerMap.push({
                    artboardLayer: artboardLayer,
                    placedLayer: placedLayer,
                    fullFileName: fullFileName
                });
                
                // この列の最大幅を更新
                if (imgWidth > columnMaxWidth) {
                    columnMaxWidth = imgWidth;
                }
                
                // 次の位置を更新
                currentY += imgHeight + VERTICAL_SPACING;
                columnHeight += imgHeight + VERTICAL_SPACING;
            } catch (err) {
                alert("ファイル処理中にエラーが発生しました: " + fullFileName + "\nエラー: " + err);
                continue; // 次のファイルに進む
            }
        }
        
        // 進捗ウィンドウを閉じる
        progressWin.close();
        
        // すべての画像を配置した後、アートボード名を変更
        renameArtboards(artboardLayerMap);
        
        alert(files.length + "個の画像をアートボードに配置し、名前を設定しました");
    } catch (e) {
        alert("エラーが発生しました: " + e + "\nライン: " + e.line);
    }
}

// 空のアートボードを作成する関数
function createEmptyArtboard(x, y, width, height, name) {
    // アートボードを作成
    var idMk = charIDToTypeID("Mk  ");
    var desc = new ActionDescriptor();
    var idnull = charIDToTypeID("null");
    var ref = new ActionReference();
    var idArtb = stringIDToTypeID("artboardSection");
    ref.putClass(idArtb);
    desc.putReference(idnull, ref);
    
    // アートボードのサイズと位置を設定
    var idartboardRect = stringIDToTypeID("artboardRect");
    var rectDesc = new ActionDescriptor();
    rectDesc.putDouble(stringIDToTypeID("top"), y);
    rectDesc.putDouble(stringIDToTypeID("left"), x);
    rectDesc.putDouble(stringIDToTypeID("bottom"), y + height);
    rectDesc.putDouble(stringIDToTypeID("right"), x + width);
    desc.putObject(idartboardRect, stringIDToTypeID("rectangle"), rectDesc);
    
    // アートボード名を設定
    var idNm = charIDToTypeID("Nm  ");
    desc.putString(idNm, name);
    
    executeAction(idMk, desc, DialogModes.NO);
    
    // 作成されたアートボードのレイヤーセットを返す
    return app.activeDocument.activeLayer;
}

// 画像をアートボードに配置する関数
function placeImageInArtboard(fileObj, artboardLayer, x, y) {
    // アートボードを選択状態にする
    app.activeDocument.activeLayer = artboardLayer;
    
    // 画像を配置
    var idPlc = charIDToTypeID("Plc ");
    var desc = new ActionDescriptor();
    var idnull = charIDToTypeID("null");
    desc.putPath(idnull, fileObj);
    var idFTcs = charIDToTypeID("FTcs");
    var idQCSt = charIDToTypeID("QCSt");
    var idQcsa = charIDToTypeID("Qcsa");
    desc.putEnumerated(idFTcs, idQCSt, idQcsa);
    executeAction(idPlc, desc, DialogModes.NO);
    
    // 配置したレイヤーを取得
    var placedLayer = app.activeDocument.activeLayer;
    
    // レイヤーを正確に位置合わせ
    var bounds = placedLayer.bounds;
    var layerLeft = bounds[0].value;
    var layerTop = bounds[1].value;
    
    // 位置を調整（アートボードの左上に合わせる）
    placedLayer.translate(x - layerLeft, y - layerTop);
    
    return placedLayer;
}

// アートボードの名前を変更する関数
function renameArtboards(artboardLayerMap) {
    for (var i = 0; i < artboardLayerMap.length; i++) {
        var item = artboardLayerMap[i];
        
        // アートボードレイヤーの名前を拡張子付きのファイル名に変更
        item.artboardLayer.name = item.fullFileName;
    }
}

// スクリプトを実行
main();
