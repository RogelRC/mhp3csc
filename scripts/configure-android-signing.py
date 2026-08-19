#!/usr/bin/env python3
import sys
import os

path = os.path.join(sys.argv[1], "app", "build.gradle.kts")

with open(path) as f:
    content = f.read()

if "FileInputStream" not in content:
    content = "import java.io.FileInputStream\n" + content

signing_block = """    signingConfigs {
        create("release") {
            val keystorePropertiesFile = rootProject.file("keystore.properties")
            val keystoreProperties = Properties()
            if (keystorePropertiesFile.exists()) {
                keystoreProperties.load(FileInputStream(keystorePropertiesFile))
            }
            keyAlias = keystoreProperties["keyAlias"] as String
            keyPassword = keystoreProperties["password"] as String
            storeFile = file(keystoreProperties["storeFile"] as String)
            storePassword = keystoreProperties["password"] as String
        }
    }
"""

if "signingConfigs" not in content:
    content = content.replace("buildTypes {", signing_block + "buildTypes {")

if 'signingConfig = signingConfigs.getByName("release")' not in content:
    content = content.replace(
        'getByName("release") {',
        'getByName("release") {\n            signingConfig = signingConfigs.getByName("release")',
    )

with open(path, "w") as f:
    f.write(content)
