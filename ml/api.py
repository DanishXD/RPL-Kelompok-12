"""
EcoSmart Feeder — ML API Server (Flask)
========================================
REST API untuk serve model Decision Tree.
Dipanggil oleh backend Fastify via HTTP.

Endpoints:
  POST /predict        → prediksi waktu & jumlah pakan
  GET  /health         → cek status server
  GET  /model-info     → info akurasi & metadata model
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle
import json
import numpy as np
import os

app = Flask(__name__)
CORS(app)

# ── Load model & metadata ─────────────────────────────────────────────────────

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def load_model(name):
    path = os.path.join(BASE_DIR, 'models', f'{name}_model.pkl')
    with open(path, 'rb') as f:
        return pickle.load(f)

def load_metadata(name):
    path = os.path.join(BASE_DIR, 'models', f'{name}_metadata.json')
    with open(path, 'r') as f:
        return json.load(f)

try:
    model_time   = load_model('time_slot')
    model_amount = load_model('amount_gram')
    meta_time    = load_metadata('time_slot')
    meta_amount  = load_metadata('amount_gram')
    print("✅ Models loaded successfully")
except FileNotFoundError:
    print("❌ Model files not found. Run train_model.py first.")
    model_time = model_amount = None
    meta_time  = meta_amount  = {}

# ── Label maps ────────────────────────────────────────────────────────────────

TIME_LABELS = {
    0: {'label': 'Pagi',                 'time': '06:00–08:00', 'description': 'Waktu pagi optimal untuk pemberian pakan'},
    1: {'label': 'Siang',                'time': '12:00–13:00', 'description': 'Waktu siang untuk pemberian pakan'},
    2: {'label': 'Sore',                 'time': '17:00–18:00', 'description': 'Waktu sore optimal untuk pemberian pakan'},
    3: {'label': 'Tidak Direkomendasikan','time': None,          'description': 'Kondisi sensor tidak mendukung pemberian pakan saat ini'},
}

AMOUNT_LABELS = {
    0: {'gram': 50,  'description': 'Kondisi kurang optimal, berikan pakan minimal'},
    1: {'gram': 100, 'description': 'Kondisi normal, berikan pakan standar'},
    2: {'gram': 150, 'description': 'Kondisi baik, berikan pakan lebih banyak'},
    3: {'gram': 200, 'description': 'Kondisi sangat optimal, berikan pakan maksimal'},
}

FEATURES = ['temperature', 'ph_level', 'feed_level', 'light_level', 'hour']

# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status':       'ok',
        'service':      'EcoSmart ML API',
        'models_loaded': model_time is not None,
    })


@app.route('/model-info', methods=['GET'])
def model_info():
    return jsonify({
        'success': True,
        'data': {
            'time_slot': {
                'accuracy':    meta_time.get('accuracy'),
                'cv_accuracy': meta_time.get('cv_accuracy_mean'),
                'features':    meta_time.get('feature_importance', {}),
            },
            'amount_gram': {
                'accuracy':    meta_amount.get('accuracy'),
                'cv_accuracy': meta_amount.get('cv_accuracy_mean'),
                'features':    meta_amount.get('feature_importance', {}),
            }
        }
    })


@app.route('/predict', methods=['POST'])
def predict():
    if model_time is None or model_amount is None:
        return jsonify({'success': False, 'error': 'Model belum diload. Jalankan train_model.py dulu.'}), 503

    body = request.get_json()
    if not body:
        return jsonify({'success': False, 'error': 'Request body kosong'}), 400

    # ── Validasi input ────────────────────────────────────────────────────────
    required = ['temperature', 'ph_level', 'feed_level', 'light_level', 'hour']
    missing  = [f for f in required if f not in body]
    if missing:
        return jsonify({'success': False, 'error': f'Field wajib tidak ada: {missing}'}), 400

    try:
        temperature = float(body['temperature'])
        ph_level    = float(body['ph_level'])
        feed_level  = float(body['feed_level'])
        light_level = float(body['light_level'])
        hour        = int(body['hour'])
    except (ValueError, TypeError) as e:
        return jsonify({'success': False, 'error': f'Tipe data tidak valid: {str(e)}'}), 400

    # ── Validasi range ────────────────────────────────────────────────────────
    if not (0 <= hour <= 23):
        return jsonify({'success': False, 'error': 'hour harus antara 0–23'}), 400
    if not (0 <= feed_level <= 100):
        return jsonify({'success': False, 'error': 'feed_level harus antara 0–100'}), 400

    # ── Prediksi ──────────────────────────────────────────────────────────────
    X = np.array([[temperature, ph_level, feed_level, light_level, hour]])

    time_pred   = int(model_time.predict(X)[0])
    amount_pred = int(model_amount.predict(X)[0])

    time_proba   = model_time.predict_proba(X)[0].tolist()
    amount_proba = model_amount.predict_proba(X)[0].tolist()

    time_info   = TIME_LABELS[time_pred]
    amount_info = AMOUNT_LABELS[amount_pred]

    # ── Buat rekomendasi teks ─────────────────────────────────────────────────
    if time_pred == 3:
        recommendation = (
            f"Kondisi kolam saat ini kurang ideal untuk pemberian pakan. "
            f"Suhu {temperature}°C, pH {ph_level}. "
            f"Tunggu hingga kondisi membaik."
        )
    else:
        recommendation = (
            f"Waktu terbaik pemberian pakan: {time_info['label']} ({time_info['time']}). "
            f"Jumlah yang direkomendasikan: {amount_info['gram']}g. "
            f"Kondisi kolam: suhu {temperature}°C, pH {ph_level}, pakan tersisa {feed_level}%."
        )

    return jsonify({
        'success': True,
        'data': {
            'input': {
                'temperature': temperature,
                'ph_level':    ph_level,
                'feed_level':  feed_level,
                'light_level': light_level,
                'hour':        hour,
            },
            'prediction': {
                'time_slot': {
                    'class':       time_pred,
                    'label':       time_info['label'],
                    'time_range':  time_info['time'],
                    'description': time_info['description'],
                    'confidence':  round(max(time_proba) * 100, 2),
                },
                'amount_gram': {
                    'class':       amount_pred,
                    'gram':        amount_info['gram'],
                    'description': amount_info['description'],
                    'confidence':  round(max(amount_proba) * 100, 2),
                },
            },
            'recommendation': recommendation,
        }
    })


# ── Run server ────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    # Render inject PORT, lokal pakai 5001
    port = int(os.environ.get('PORT', os.environ.get('ML_PORT', 5001)))
    print(f"\n🤖 EcoSmart ML API running on port {port}")
    print(f"   POST /predict    → prediksi waktu & jumlah pakan")
    print(f"   GET  /health     → status server")
    print(f"   GET  /model-info → akurasi model\n")
    app.run(host='0.0.0.0', port=port, debug=False)
