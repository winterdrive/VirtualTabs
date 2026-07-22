import * as vscode from 'vscode';

/**
 * Internationalization utility class
 * Provides multi-language string loading and formatting
 */
export class I18n {
    private static messages: { [key: string]: string } = {};
    private static isInitialized: boolean = false;

    /**
     * Initialize the i18n module
     * Load the message file for the corresponding language
     */
    public static async initialize(context: vscode.ExtensionContext): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            // Get VS Code language setting
            const locale = vscode.env.language || 'en';
            
            // Try to load the corresponding language file
            const loaded = await this.loadLanguageFile(context, locale);
            
            if (!loaded) {
                // If loading fails, try to load English as fallback
                await this.loadLanguageFile(context, 'en');
            }
            
            this.isInitialized = true;
        } catch (error) {
            console.error('i18n initialization failed:', error);
            // Use English as the final fallback
            await this.loadLanguageFile(context, 'en');
            this.isInitialized = true;
        }
    }

    /**
     * Load the specified language file
     * @param context Extension context
     * @param locale Language code
     * @returns Whether loading succeeded
     */
    private static async loadLanguageFile(context: vscode.ExtensionContext, locale: string): Promise<boolean> {
        try {
            const uri = vscode.Uri.joinPath(context.extensionUri, 'i18n', `${locale}.json`);
            const content = await vscode.workspace.fs.readFile(uri);
            const messages = JSON.parse(content.toString());
            this.messages = messages;
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get localized string
     * @param key Message key
     * @param args Formatting parameters
     * @returns Localized string
     */
    public static getMessage(key: string, ...args: string[]): string {
        let message = this.messages[key] || key;

        // Format string (replace {0}, {1}, ... placeholders).
        // Use a replacer function (not a string) so literal '$' characters in
        // args (e.g. UNC paths like \\server\C$\path, or error messages)
        // aren't interpreted as special replacement patterns ($&, $1, ...).
        for (let i = 0; i < args.length; i++) {
            message = message.replace(new RegExp(`\\{${i}\\}`, 'g'), () => args[i]);
        }

        return message;
    }

    /**
     * Convenience method: get group name
     * @param baseName Base name
     * @param index Group index (for auto-naming)
     * @returns Group name
     */
    public static getGroupName(baseName?: string, index?: number): string {
        if (baseName) {
            return baseName;
        }
        
        const baseText = this.getMessage('group.newGroupName');
        return index ? `${baseText} ${index}` : baseText;
    }

    /**
     * Convenience method: get built-in group name
     * @returns Built-in group name
     */
    public static getBuiltInGroupName(): string {
        return this.getMessage('group.builtInName');
    }

    /**
     * Convenience method: get auto group prefix
     * @param extension File extension
     * @returns Auto group name
     */
    public static getAutoGroupName(extension: string): string {
        const prefix = this.getMessage('group.autoGroupPrefix');
        return `${prefix} .${extension}`;
    }

    /**
     * Convenience method: get copy group name
     * @param originalName Original name
     * @param index Copy index
     * @returns Copy group name
     */
    public static getCopyGroupName(originalName: string, index?: number): string {
        const postfix = this.getMessage('group.copyPostfix');
        return index ? `${originalName} ${postfix} ${index}` : `${originalName} ${postfix}`;
    }

    /**
     * Check if initialized
     * @returns Whether initialized
     */
    public static isReady(): boolean {
        return this.isInitialized;
    }

    /**
     * Reload language file (used when language setting changes)
     * @param context Extension context
     */
    public static async reload(context: vscode.ExtensionContext): Promise<void> {
        this.isInitialized = false;
        this.messages = {};
        await this.initialize(context);
    }
}
