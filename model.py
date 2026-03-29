import pandas as pd
from joblib import dump
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split


def main() -> None:
    # Load dataset from the data folder.
    df = pd.read_csv("data/loan_approval_dataset.csv")

    # Strip whitespace from column names and all string values.
    df.columns = df.columns.str.strip()
    object_columns = df.select_dtypes(include=["object"]).columns
    df[object_columns] = df[object_columns].apply(lambda col: col.str.strip())

    # Drop non-feature identifier column.
    df = df.drop(columns=["loan_id"])

    # Binary label encoding for categorical feature columns.
    df["education"] = df["education"].map({"Graduate": 1, "Not Graduate": 0})
    df["self_employed"] = df["self_employed"].map({"Yes": 1, "No": 0})

    # Encode target variable as requested: Approved=1, Rejected=0.
    df["loan_status"] = df["loan_status"].map({"Approved": 1, "Rejected": 0})

    # Separate features and target.
    X = df.drop(columns=["loan_status"])
    y = df["loan_status"]

    # 80/10/10 split via two train_test_split calls.
    X_train, X_temp, y_train, y_temp = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.5, random_state=42, stratify=y_temp
    )

    # Train model.
    model = GradientBoostingClassifier(random_state=42)
    model.fit(X_train, y_train)

    # Evaluate accuracy on all splits.
    train_accuracy = accuracy_score(y_train, model.predict(X_train))
    val_accuracy = accuracy_score(y_val, model.predict(X_val))
    test_accuracy = accuracy_score(y_test, model.predict(X_test))

    print(f"Train Accuracy: {train_accuracy:.4f}")
    print(f"Validation Accuracy: {val_accuracy:.4f}")
    print(f"Test Accuracy: {test_accuracy:.4f}")

    # Save model in the project root.
    dump(model, "model.pkl")
    print("Saved trained model to model.pkl")

    # Single sample prediction from test set.
    sample_features = X_test.iloc[[0]]
    sample_true = y_test.iloc[0]
    sample_pred = model.predict(sample_features)[0]

    pred_label = "Approved" if sample_pred == 1 else "Rejected"
    true_label = "Approved" if sample_true == 1 else "Rejected"
    print(f"Sample Prediction: {pred_label} (true label: {true_label})")


if __name__ == "__main__":
    main()
