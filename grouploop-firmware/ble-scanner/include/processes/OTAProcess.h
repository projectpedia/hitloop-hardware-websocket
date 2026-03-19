#ifndef OTA_PROCESS_H
#define OTA_PROCESS_H

#include "Process.h"
#include "ProcessManager.h"
#include "CommandRegistry.h"
#include "processes/LedProcess.h"
#include <HTTPUpdate.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>

class OTAProcess : public Process {
public:
    OTAProcess() : Process(), otaBreathing(0x00FF00, 500) {}

    void setup() override {
        commandRegistry.registerCommand("ota", [this](const String& params) {
            if (params.length() == 0) {
                Serial.println("OTA: no URL provided");
                return;
            }
            performUpdate(params);
        });
        Serial.println("OTA process ready");
    }

    void update() override {
        // OTA is command-triggered; nothing to poll
    }

private:
    BreathingBehavior otaBreathing;

    void performUpdate(const String& url) {
        Serial.print("OTA: starting update from ");
        Serial.println(url);

        // Halt non-essential processes to free resources
        if (processManager) {
            processManager->haltProcess("ble");
            processManager->haltProcess("publish");
        }

        // Switch LED to fast green breathing during update
        LedProcess* ledProcess = static_cast<LedProcess*>(processManager->getProcess("led"));
        LedBehavior* previousBehavior = ledProcess ? ledProcess->currentBehavior : nullptr;
        if (ledProcess) {
            ledProcess->setBehavior(&otaBreathing);
        }

        httpUpdate.rebootOnUpdate(true);

        t_httpUpdate_return result;

        if (url.startsWith("https://")) {
            WiFiClientSecure client;
            client.setInsecure(); // accept self-signed certs
            result = httpUpdate.update(client, url);
        } else {
            WiFiClient client;
            result = httpUpdate.update(client, url);
        }

        switch (result) {
            case HTTP_UPDATE_OK:
                // rebootOnUpdate(true) means we never reach here
                Serial.println("OTA: update applied, rebooting");
                break;
            case HTTP_UPDATE_NO_UPDATES:
                Serial.println("OTA: server reported no update needed");
                if (ledProcess && previousBehavior) ledProcess->setBehavior(previousBehavior);
                resumeProcesses();
                break;
            case HTTP_UPDATE_FAILED:
                Serial.printf("OTA: failed (%d) %s\n",
                    httpUpdate.getLastError(),
                    httpUpdate.getLastErrorString().c_str());
                if (ledProcess && previousBehavior) ledProcess->setBehavior(previousBehavior);
                resumeProcesses();
                break;
        }
    }

    void resumeProcesses() {
        if (processManager) {
            processManager->startProcess("ble");
            processManager->startProcess("publish");
        }
    }
};

#endif // OTA_PROCESS_H
