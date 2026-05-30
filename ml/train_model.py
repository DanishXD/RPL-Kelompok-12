"""
EcoSmart Feeder — Train Decision Tree Model
============================================
Melatih dua model Decision Tree:
1. Model waktu pakan  → recommended_time_slot
2. Model jumlah pakan → recommended_amount_gram

Output: model disimpan ke models/ sebagai file .pkl
"""

import pandas as pd
import numpy as np
import os
import json
import pickle
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')  # non-interactive backend

from sklearn.tree import DecisionTreeClassifier, export_text, plot_tree
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import (
    classification_report, confusion_matrix,
    accuracy_score, ConfusionMatrixDisplay
)
from sklearn.preprocessing import LabelEncoder

# ── Load dataset ──────────────────────────────────────────────────────────────

df = pd.read_csv('data/feeding_dataset.csv')
print(f"Dataset loaded: {len(df)} rows\n")

FEATURES = ['temperature', 'ph_level', 'feed_level', 'light_level', 'hour']
X = df[FEATURES]

TIME_LABELS   = {0: 'Pagi (06-08)', 1: 'Siang (12-13)', 2: 'Sore (17-18)', 3: 'Tidak Direkomendasikan'}
AMOUNT_LABELS = {0: '50g', 1: '100g', 2: '150g', 3: '200g'}

os.makedirs('models',  exist_ok=True)
os.makedirs('reports', exist_ok=True)

# ── Fungsi train & evaluasi ───────────────────────────────────────────────────

def train_and_evaluate(X, y, target_name, class_labels, max_depth=6):
    print(f"\n{'='*60}")
    print(f"  Training: {target_name}")
    print(f"{'='*60}")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    model = DecisionTreeClassifier(
        max_depth=max_depth,
        min_samples_split=10,
        min_samples_leaf=5,
        random_state=42,
        criterion='gini'
    )
    model.fit(X_train, y_train)

    # ── Evaluasi ──────────────────────────────────────────────────────────────
    y_pred = model.predict(X_test)
    acc    = accuracy_score(y_test, y_pred)

    cv_scores = cross_val_score(model, X, y, cv=5, scoring='accuracy')

    print(f"\nTest Accuracy  : {acc:.4f} ({acc*100:.2f}%)")
    print(f"CV Accuracy    : {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")
    print(f"\nClassification Report:")
    print(classification_report(
        y_test, y_pred,
        target_names=[class_labels[i] for i in sorted(class_labels.keys())]
    ))

    # ── Feature importance ────────────────────────────────────────────────────
    importance = pd.Series(model.feature_importances_, index=FEATURES)
    print(f"Feature Importance:")
    print(importance.sort_values(ascending=False).to_string())

    # ── Simpan model ──────────────────────────────────────────────────────────
    model_path = f'models/{target_name}_model.pkl'
    with open(model_path, 'wb') as f:
        pickle.dump(model, f)
    print(f"\n✅ Model saved: {model_path}")

    # ── Simpan metadata model ─────────────────────────────────────────────────
    metadata = {
        'target':           target_name,
        'features':         FEATURES,
        'classes':          class_labels,
        'accuracy':         round(acc, 4),
        'cv_accuracy_mean': round(cv_scores.mean(), 4),
        'cv_accuracy_std':  round(cv_scores.std(), 4),
        'max_depth':        max_depth,
        'n_train':          len(X_train),
        'n_test':           len(X_test),
        'feature_importance': {
            f: round(float(v), 4)
            for f, v in zip(FEATURES, model.feature_importances_)
        }
    }
    with open(f'models/{target_name}_metadata.json', 'w') as f:
        json.dump(metadata, f, indent=2)

    # ── Plot confusion matrix ─────────────────────────────────────────────────
    fig, ax = plt.subplots(figsize=(8, 6))
    cm = confusion_matrix(y_test, y_pred)
    disp = ConfusionMatrixDisplay(
        confusion_matrix=cm,
        display_labels=[class_labels[i] for i in sorted(class_labels.keys())]
    )
    disp.plot(ax=ax, cmap='Blues', colorbar=False)
    ax.set_title(f'Confusion Matrix — {target_name}\nAccuracy: {acc*100:.2f}%')
    plt.xticks(rotation=30, ha='right')
    plt.tight_layout()
    plt.savefig(f'reports/{target_name}_confusion_matrix.png', dpi=150)
    plt.close()

    # ── Plot decision tree ────────────────────────────────────────────────────
    fig, ax = plt.subplots(figsize=(20, 10))
    plot_tree(
        model,
        feature_names=FEATURES,
        class_names=[class_labels[i] for i in sorted(class_labels.keys())],
        filled=True, rounded=True, fontsize=8, ax=ax, max_depth=3
    )
    ax.set_title(f'Decision Tree — {target_name} (max depth shown: 3)')
    plt.tight_layout()
    plt.savefig(f'reports/{target_name}_decision_tree.png', dpi=150)
    plt.close()
    print(f"📊 Reports saved to reports/")

    # ── Print tree rules (text) ───────────────────────────────────────────────
    rules = export_text(model, feature_names=FEATURES, max_depth=3)
    with open(f'reports/{target_name}_rules.txt', 'w') as f:
        f.write(rules)

    return model, metadata

# ── Train kedua model ─────────────────────────────────────────────────────────

model_time,   meta_time   = train_and_evaluate(X, df['recommended_time_slot'],   'time_slot',   TIME_LABELS,   max_depth=6)
model_amount, meta_amount = train_and_evaluate(X, df['recommended_amount_gram'], 'amount_gram', AMOUNT_LABELS, max_depth=6)

# ── Summary ───────────────────────────────────────────────────────────────────

print(f"\n{'='*60}")
print(f"  TRAINING SUMMARY")
print(f"{'='*60}")
print(f"  time_slot   accuracy : {meta_time['accuracy']*100:.2f}%")
print(f"  amount_gram accuracy : {meta_amount['accuracy']*100:.2f}%")
print(f"\n  Files generated:")
print(f"  models/time_slot_model.pkl")
print(f"  models/amount_gram_model.pkl")
print(f"  models/time_slot_metadata.json")
print(f"  models/amount_gram_metadata.json")
print(f"  reports/time_slot_confusion_matrix.png")
print(f"  reports/amount_gram_confusion_matrix.png")
print(f"  reports/time_slot_decision_tree.png")
print(f"  reports/amount_gram_decision_tree.png")
print(f"\n✅ Training selesai!")
