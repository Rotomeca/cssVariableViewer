# 🌈 CSS Variable Viewer

Une extension VS Code pour visualiser, rechercher et naviguer dans les **variables CSS définies dans `:root`**, avec support **dark/light mode**, **aperçu des couleurs**, et **navigation depuis le code**.

---

## ✨ Fonctionnalités

- 🔍 **Analyse automatique** des fichiers `.css` et `.less`
- 🎨 Affichage en tableau des variables trouvées dans `:root`, `:root.dark`, `:root.light`, etc.
- 🌗 Support de la détection par thème (`:root.dark`, `:root.light`, etc.)
- 🖼️ **Aperçu couleur** directement dans le tableau
- 🔁 Mise à jour **dynamique** à chaque modification du fichier
- 🖱️ **Double-clic ou clic droit** sur une variable → focus direct dans le tableau
- 🔦 Ligne ciblée **surlignée automatiquement**
- 🔡 **Filtre instantané** par nom de variable
- ⌨️ **Raccourci clavier** configurable pour naviguer rapidement

---

## 🚀 Utilisation

1. Ouvre un fichier `.css` ou `.less`
2. Exécute la commande `Afficher les variables CSS` (ou via la palette `Ctrl+Shift+P`)
3. Le panneau affiche toutes les variables dans les blocs `:root`, `:root.dark`, etc.

---

### 🔁 Navigation rapide

- 🖱️ **Clic-droit** sur une variable → `Focus dans le tableau`
- ⌨️ **Raccourci clavier** : `Ctrl+Shift+F` / `Cmd+Shift+F`

---

## 📦 Installation

```bash
# Depuis le marketplace
ext install nom-du-publisher.css-variable-viewer

# Ou localement
code --install-extension css-variable-viewer.vsix
```